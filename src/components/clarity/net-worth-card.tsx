"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { convertFx } from "@/lib/fx";
import { useCurrency } from "@/components/currency-context";

// Clarity net-worth hero (spec 2a) — glass card with big Space Grotesk number,
// mint-faded cents, delta pill, and the USD/CAD/HKD currency toggle. Chart
// lives in a separate NetWorthTrendCard below (kept its own card for v0 — the
// existing Recharts implementation is 341 lines and rewriting in Clarity style
// is a follow-up).

type Row = {
  native_currency: string;
  value_native: number | null;
  previous_value_native: number | null;
};

function formatWhole(
  value: number,
  currency: string,
): { whole: string; cents: string } {
  try {
    const parts = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).formatToParts(value);
    const whole = parts
      .filter((p) => p.type !== "fraction" && p.type !== "decimal")
      .map((p) => p.value)
      .join("");
    const decimal = parts.find((p) => p.type === "decimal")?.value ?? ".";
    const fraction = parts.find((p) => p.type === "fraction")?.value ?? "00";
    return { whole, cents: decimal + fraction };
  } catch {
    return {
      whole: `${currency} ${Math.floor(value).toLocaleString("en-US")}`,
      cents: "",
    };
  }
}

function formatSignedAbs(value: number, currency: string): string {
  const abs = Math.abs(value);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(abs);
  } catch {
    return `${currency} ${abs.toLocaleString("en-US")}`;
  }
}

export function NetWorthCard({ rows }: { rows: Row[] }) {
  const { currency, setCurrency, currencies, fxRates } = useCurrency();

  // Same delta-basis math as NetWorthHero: two parallel totals so a partial
  // previous-close set doesn't understate the %.
  const { total, deltaValue, deltaPct } = useMemo(() => {
    let total = 0;
    let deltaBasis = 0;
    let prevBasis = 0;
    for (const r of rows) {
      if (r.value_native == null) continue;
      let cur: number | null = null;
      if (r.native_currency === currency) cur = r.value_native;
      else if (fxRates)
        cur = convertFx(r.value_native, r.native_currency, currency, fxRates);
      if (cur == null) continue;
      total += cur;

      if (r.previous_value_native == null) continue;
      let prev: number | null = null;
      if (r.native_currency === currency) prev = r.previous_value_native;
      else if (fxRates)
        prev = convertFx(
          r.previous_value_native,
          r.native_currency,
          currency,
          fxRates,
        );
      if (prev == null) continue;
      deltaBasis += cur;
      prevBasis += prev;
    }
    return {
      total,
      deltaValue: prevBasis > 0 ? deltaBasis - prevBasis : null,
      deltaPct: prevBasis > 0 ? ((deltaBasis - prevBasis) / prevBasis) * 100 : null,
    };
  }, [rows, currency, fxRates]);

  const anyValue = rows.some((r) => r.value_native != null);

  // Count-up on total change (mount, currency switch, price refresh).
  const [display, setDisplay] = useState(0);
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
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (to - from) * eased;
      setDisplay(value);
      fromRef.current = value;
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [total, currency, anyValue]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const { whole, cents } = anyValue
    ? formatWhole(display, currency)
    : { whole: "—", cents: "" };
  const isPositive = deltaValue != null && deltaValue >= 0;
  const deltaColor = isPositive ? "#00E5A0" : "#FF5000";

  return (
    <section className="clarity-card p-7">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div className="min-w-0">
          {/* Live label */}
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E5A0] clarity-pulseg" />
            <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-[#8a8d92]">
              Net worth · Live
            </span>
          </div>
          {/* Big number */}
          <div className="font-display font-bold text-[36px] sm:text-[40px] md:text-[44px] text-white tracking-[-0.02em] leading-[0.95] tabular-nums">
            {whole}
            {cents && (
              <span className="text-[#4a4d52] text-[28px]">{cents}</span>
            )}
          </div>
          {/* Delta */}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            {deltaValue != null ? (
              <>
                <span
                  className="inline-flex items-center gap-1.5 font-display font-bold text-[15px] rounded-full px-2.5 py-1 tabular-nums"
                  style={{
                    background: `${deltaColor}1f`,
                    color: deltaColor,
                  }}
                >
                  {isPositive ? "↑" : "↓"} {formatSignedAbs(deltaValue, currency)}
                </span>
                {deltaPct != null && (
                  <span
                    className="font-display font-bold text-[15px] tabular-nums"
                    style={{ color: deltaColor }}
                  >
                    {isPositive ? "+" : "−"}
                    {Math.abs(deltaPct).toFixed(2)}%
                  </span>
                )}
                <span className="text-[13px] text-[#6b6e73]">
                  since prev close
                </span>
              </>
            ) : (
              <span className="text-[13px] text-[#6b6e73]">
                Backfilling · check back shortly
              </span>
            )}
          </div>
        </div>
        {/* Currency toggle */}
        {currencies.length > 1 && (
          <div className="flex gap-1 bg-black/[0.28] border border-white/[0.08] rounded-full p-1 shrink-0">
            {currencies.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={cn(
                  "font-mono text-[12px] rounded-full px-3 py-1.5 transition-colors",
                  c === currency
                    ? "bg-[#00E5A0] text-[#052018] font-semibold"
                    : "text-[#8a8d92] hover:text-white",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
