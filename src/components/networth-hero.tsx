"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { convertFx } from "@/lib/fx";
import { useCurrency } from "@/components/currency-context";

type Row = {
  native_currency: string;
  value_native: number | null;
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

/**
 * Net-worth hero with a currency pill toggle. State lives in CurrencyContext
 * so the asset list can re-render its row values in the selected currency too.
 *
 * Liveness:
 *   - Counts up from 0 → total on mount (ease-out cubic, 900ms)
 *   - Re-animates whenever `total` or `currency` changes (from → to)
 *   - Pulsing aqua "LIVE" dot beside the eyebrow label
 *   - Subtle tick flash on the number when the target shifts
 */
export function NetWorthHero({ rows }: { rows: Row[] }) {
  const { currency, setCurrency, currencies, fxRates } = useCurrency();

  const { total, skipped } = useMemo(() => {
    let total = 0;
    let skipped = 0;
    for (const r of rows) {
      if (r.value_native == null) continue;
      if (r.native_currency === currency) {
        total += r.value_native;
        continue;
      }
      if (!fxRates) {
        skipped++;
        continue;
      }
      const c = convertFx(r.value_native, r.native_currency, currency, fxRates);
      if (c == null) {
        skipped++;
        continue;
      }
      total += c;
    }
    return { total, skipped };
  }, [rows, currency, fxRates]);

  const anyValue = rows.some((r) => r.value_native != null);

  // --- Animated counter ---
  const [display, setDisplay] = useState(0);
  const [flash, setFlash] = useState(false);
  const rafRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // setState calls here drive the rAF-based count-up and the flash flag —
    // these are animation state transitions, not derivable from props, so
    // the cascading-render rule doesn't apply.
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
    <section className="relative flex flex-col gap-2 p-6 rounded-lg bg-surface border border-border overflow-hidden">
      {/* Subtle aqua ambient glow on the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(circle at 0% 0%, rgba(127,255,212,0.08), transparent 60%)",
        }}
      />

      {/* Top row: label + currency pills */}
      <div className="relative flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full bg-[#7FFFD4] f3-pulse"
            style={{ boxShadow: "0 0 8px #7FFFD4" }}
          />
          <span className="font-plex text-[11px] text-text-muted uppercase tracking-[0.14em] font-medium">
            Net worth · {currency} · live
          </span>
        </div>
        {currencies.length > 1 && (
          <div className="flex items-center gap-1 p-0.5 rounded-pill bg-background/50 border border-border">
            {currencies.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={cn(
                  "h-6 px-2.5 rounded-pill text-[11px] font-semibold transition-colors",
                  c === currency
                    ? "bg-gold text-primary-foreground"
                    : "text-text-secondary hover:text-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Big number — animated + flash on change */}
      <div
        className={cn(
          "relative font-display text-5xl font-bold tabular-nums transition-colors duration-300",
          flash ? "text-[#7FFFD4]" : "text-foreground",
        )}
        style={{
          textShadow: flash ? "0 0 24px rgba(127,255,212,0.4)" : "none",
          transition: "color 300ms ease-out, text-shadow 300ms ease-out",
        }}
      >
        {anyValue ? formatMoney(display, currency) : "—"}
      </div>

      {/* Status line */}
      <div className="relative text-sm text-text-muted">
        {!anyValue ? (
          "Add your first asset to see your net worth."
        ) : skipped > 0 ? (
          <>
            Excludes {skipped} asset{skipped === 1 ? "" : "s"} — no FX rate
            available.
          </>
        ) : (
          <>
            Across {rows.filter((r) => r.value_native != null).length} asset
            {rows.length === 1 ? "" : "s"}
            {fxRates && currencies.length > 1
              ? " · converted at daily ECB rate"
              : ""}
          </>
        )}
      </div>
    </section>
  );
}
