"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { convertFx } from "@/lib/fx";
import { useCurrency } from "@/components/currency-context";

type Row = {
  native_currency: string;
  value_native: number | null;
  /** value ~24h ago in the same native currency, if the provider had prev close */
  previous_value_native: number | null;
};

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: value < 10 ? 4 : 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
}

function formatDelta(value: number, currency: string) {
  const sign = value >= 0 ? "+" : "−";
  const abs = Math.abs(value);
  try {
    const s = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: abs < 10 ? 2 : 0,
    }).format(abs);
    return `${sign}${s}`;
  } catch {
    return `${sign}${currency} ${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
}

/**
 * Dashboard hero — net worth is the headline, TODAY + ASSETS stack as a
 * smaller sub-row below (matches the landing's 3-cell visual hierarchy but
 * with the net-worth cell promoted to hero scale).
 *
 * Today delta is deferred to a follow-up pass: we need price snapshots over
 * time to compute it, and the price_cache table only stores latest. For now
 * it renders as "—" with a subtle "tracking soon" label so the layout stays
 * intact and the slot is reserved.
 *
 * Liveness:
 *   - Count-up from 0 → total on mount (ease-out cubic, 900ms)
 *   - Re-animates on currency switch
 *   - Pulsing aqua LIVE dot + subtle flash on the number when target shifts
 */
export function NetWorthHero({ rows }: { rows: Row[] }) {
  const { currency, setCurrency, currencies, fxRates } = useCurrency();

  // Two separate totals so TODAY stays honest:
  //   `total`        — sum of everything priced, for the headline net worth.
  //   `deltaBasis`   — sum of only rows that ALSO have a previous-close
  //                    counterpart, paired 1-to-1 with `prevBasis`. That way
  //                    the % is (basis_now − basis_prev) / basis_prev, not
  //                    (full_now − partial_prev) / partial_prev which used
  //                    to under-state losses when a new asset had no
  //                    previous_native yet.
  //   `pendingDelta` — count of priced assets still missing a previous, so
  //                    we can tell the user "partial" vs "complete" coverage.
  const { total, deltaValue, deltaPct, skipped, pendingDelta } = useMemo(() => {
    let total = 0;
    let deltaBasis = 0;
    let prevBasis = 0;
    let skipped = 0;
    let pendingDelta = 0;
    for (const r of rows) {
      if (r.value_native == null) continue;
      let cur: number | null = null;
      if (r.native_currency === currency) {
        cur = r.value_native;
      } else if (fxRates) {
        cur = convertFx(r.value_native, r.native_currency, currency, fxRates);
      }
      if (cur == null) {
        skipped++;
        continue;
      }
      total += cur;

      if (r.previous_value_native == null) {
        pendingDelta++;
        continue;
      }
      let prev: number | null = null;
      if (r.native_currency === currency) {
        prev = r.previous_value_native;
      } else if (fxRates) {
        prev = convertFx(
          r.previous_value_native,
          r.native_currency,
          currency,
          fxRates,
        );
      }
      if (prev == null) {
        pendingDelta++;
        continue;
      }
      deltaBasis += cur;
      prevBasis += prev;
    }
    const deltaValue = prevBasis > 0 ? deltaBasis - prevBasis : null;
    const deltaPct =
      prevBasis > 0 ? ((deltaBasis - prevBasis) / prevBasis) * 100 : null;
    return { total, deltaValue, deltaPct, skipped, pendingDelta };
  }, [rows, currency, fxRates]);

  const anyValue = rows.some((r) => r.value_native != null);
  const assetsWithValue = rows.filter((r) => r.value_native != null).length;

  // Classify assets for the sub-row caption (e.g. "across 3 classes")
  const nativeCcySet = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) s.add(r.native_currency);
    return s;
  }, [rows]);

  const [display, setDisplay] = useState(0);
  const [flash, setFlash] = useState(false);
  const rafRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!anyValue) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const from = fromRef.current;
    const to = total;
    if (Math.abs(to - from) < 0.001) return;
    const start = performance.now();
    const duration = 900;

    setFlash(true);
    const flashTimer = window.setTimeout(() => setFlash(false), 420);

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (to - from) * eased;
      setDisplay(value);
      fromRef.current = value;
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.clearTimeout(flashTimer);
    };
  }, [total, currency, anyValue]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <section className="relative flex flex-col gap-6 p-7 rounded-2xl bg-[#0A0A0A] border border-white/[0.08] overflow-hidden">
      {/* Ambient aqua bloom in the top-left corner */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 0% 0%, rgba(127,255,212,0.1), transparent 55%)",
        }}
      />

      {/* --- Eyebrow row: live label + currency pills --- */}
      <div className="relative flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full bg-[#7FFFD4] f3-pulse"
            style={{ boxShadow: "0 0 10px #7FFFD4" }}
          />
          <span className="font-plex text-[11px] text-text-muted uppercase tracking-[0.18em] font-medium">
            Net worth · live
          </span>
        </div>
        {currencies.length > 1 && (
          <div className="flex items-center gap-1 p-0.5 rounded-pill bg-black/40 border border-white/[0.08]">
            {currencies.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={cn(
                  "h-6 px-2.5 rounded-pill text-[11px] font-semibold font-plex transition-colors",
                  c === currency
                    ? "bg-[#7FFFD4] text-black"
                    : "text-text-secondary hover:text-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* --- Hero number: huge, animated --- */}
      <div className="relative flex flex-col gap-1">
        <div
          className={cn(
            "font-display font-bold tabular-nums leading-none tracking-[-0.03em]",
            "text-[32px] sm:text-[40px] md:text-[48px]",
            flash ? "text-[#7FFFD4]" : "text-foreground",
          )}
          style={{
            textShadow: flash ? "0 0 24px rgba(127,255,212,0.4)" : "none",
            transition: "color 300ms ease-out, text-shadow 300ms ease-out",
          }}
        >
          {anyValue ? formatMoney(display, currency) : "—"}
        </div>
        {!anyValue && (
          <div className="mt-2 text-sm text-text-muted">
            Add your first asset to see your net worth.
          </div>
        )}
      </div>

      {/* --- Sub-row: TODAY + ASSETS, smaller display --- */}
      {anyValue && (
        <div className="relative grid grid-cols-2 gap-px bg-white/[0.08] rounded-xl overflow-hidden">
          {/* TODAY */}
          <div className="bg-[#0A0A0A] p-5 flex flex-col gap-1.5">
            <div className="font-plex text-[11px] text-text-muted uppercase tracking-[0.14em] font-medium">
              Today
            </div>
            <div
              className={cn(
                "font-display text-xl font-bold tabular-nums",
                deltaValue == null
                  ? "text-text-muted"
                  : deltaValue >= 0
                    ? "text-[#00C805]"
                    : "text-[#FF5000]",
              )}
            >
              {deltaValue == null
                ? "—"
                : formatDelta(deltaValue, currency)}
            </div>
            <div className="font-plex text-[11px] text-text-muted/70">
              {deltaPct == null
                ? "Backfilling · check back shortly"
                : pendingDelta > 0
                  ? `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(2)}% · ${pendingDelta} still backfilling`
                  : `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(2)}% since prev close`}
            </div>
          </div>

          {/* ASSETS */}
          <div className="bg-[#0A0A0A] p-5 flex flex-col gap-1.5">
            <div className="font-plex text-[11px] text-text-muted uppercase tracking-[0.14em] font-medium">
              Assets
            </div>
            <div className="font-display text-xl font-bold tabular-nums">
              {assetsWithValue}
            </div>
            <div className="font-plex text-[11px] text-text-muted/70">
              across {nativeCcySet.size} currenc
              {nativeCcySet.size === 1 ? "y" : "ies"}
              {skipped > 0
                ? ` · ${skipped} without FX`
                : fxRates && currencies.length > 1
                  ? " · daily ECB rate"
                  : ""}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
