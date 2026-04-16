"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { convertFx } from "@/lib/fx";

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

// Remember the last currency the user picked — but only in-session, so
// it doesn't diverge from profile.base_currency across devices.
const STORAGE_KEY = "marbs:view-currency";

export function NetWorthHero({
  rows,
  baseCurrency,
  fxRates,
}: {
  rows: Row[];
  baseCurrency: string;
  /** null means FX fetch failed — we'll disable cross-currency totals. */
  fxRates: Record<string, number> | null;
}) {
  // Deduped list of currencies user can toggle between.
  const currencies = useMemo(() => {
    const set = new Set<string>([baseCurrency]);
    for (const r of rows) set.add(r.native_currency);
    return Array.from(set);
  }, [rows, baseCurrency]);

  const [currency, setCurrency] = useState<string>(baseCurrency);

  // Restore last-used currency from localStorage (client-only).
  useEffect(() => {
    const saved = typeof window !== "undefined"
      ? window.localStorage.getItem(STORAGE_KEY)
      : null;
    if (saved && currencies.includes(saved)) setCurrency(saved);
    // currencies change rarely; run on mount is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, currency);
    }
  }, [currency]);

  // Compute total in selected currency, and count rows we had to skip.
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
      const converted = convertFx(
        r.value_native,
        r.native_currency,
        currency,
        fxRates,
      );
      if (converted == null) {
        skipped++;
        continue;
      }
      total += converted;
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
