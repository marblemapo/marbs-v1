"use client";

import { useMemo } from "react";
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

  return (
    <section className="flex flex-col gap-2 p-6 rounded-lg bg-surface border border-border">
      {/* Top row: label + currency pills */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[11px] text-text-muted uppercase tracking-wider font-medium">
          Net worth · {currency}
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

      {/* Big number */}
      <div className="font-display text-5xl font-bold tabular-nums">
        {anyValue ? formatMoney(total, currency) : "—"}
      </div>

      {/* Status line */}
      <div className="text-sm text-text-muted">
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
