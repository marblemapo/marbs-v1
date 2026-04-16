"use client";

import { useState } from "react";
import Image from "next/image";
import { EditAssetDrawer, type EditableAsset } from "@/components/edit-asset-drawer";
import { useCurrency } from "@/components/currency-context";
import { convertFx } from "@/lib/fx";

export type AssetListRow = EditableAsset & {
  asset_class: "equity" | "etf" | "crypto" | "cash";
  price_source: "yahoo" | "coingecko" | "finnhub" | "twelvedata" | "manual";
  value_native: number | null;
  logo: string | null;
};

const CLASS_LABELS: Record<AssetListRow["asset_class"], string> = {
  equity: "Stock",
  etf: "ETF",
  crypto: "Crypto",
  cash: "Cash",
};

const FMT_COMPACT = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: value < 10 ? 4 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
}

export function AssetsList({ rows }: { rows: AssetListRow[] }) {
  const [editing, setEditing] = useState<EditableAsset | null>(null);
  const { currency, fxRates } = useCurrency();

  return (
    <>
      <div className="flex flex-col rounded-lg bg-surface border border-border divide-y divide-border overflow-hidden">
        {rows.map((r) => {
          // Convert value + price to the currently-viewed currency. If the
          // FX rate is missing (rare), fall back to native and flag it.
          const sameCurrency = r.native_currency === currency;
          let displayValue: number | null = null;
          let displayPrice: number | null = null;
          let displayCurrency = currency;
          let usingNative = false;

          if (sameCurrency) {
            displayValue = r.value_native;
            displayPrice = r.latest_price;
          } else if (fxRates && r.value_native != null) {
            displayValue = convertFx(
              r.value_native,
              r.native_currency,
              currency,
              fxRates,
            );
            if (r.latest_price != null) {
              displayPrice = convertFx(
                r.latest_price,
                r.native_currency,
                currency,
                fxRates,
              );
            }
            if (displayValue == null) {
              // FX couldn't resolve — show native so the user sees something.
              usingNative = true;
              displayValue = r.value_native;
              displayPrice = r.latest_price;
              displayCurrency = r.native_currency;
            }
          } else {
            // No FX rates at all; show native.
            usingNative = true;
            displayValue = r.value_native;
            displayPrice = r.latest_price;
            displayCurrency = r.native_currency;
          }

          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setEditing(r)}
              className="flex items-center gap-3 p-4 hover:bg-surface-hover transition-colors text-left w-full"
            >
              {/* Logo / initials */}
              {r.logo ? (
                <Image
                  src={r.logo}
                  alt=""
                  width={36}
                  height={36}
                  className="w-9 h-9 rounded-full shrink-0 bg-white/5 object-contain"
                  unoptimized
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gold-dim text-gold text-[10px] font-bold flex items-center justify-center shrink-0">
                  {(r.symbol ?? r.name).slice(0, 3).toUpperCase()}
                </div>
              )}

              {/* Identity */}
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-base font-bold truncate">
                    {r.symbol ?? r.name}
                  </span>
                  <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
                    {CLASS_LABELS[r.asset_class]}
                  </span>
                </div>
                <div className="text-xs text-text-muted truncate">
                  {r.latest_quantity != null ? (
                    <>
                      <span className="tabular-nums">
                        {FMT_COMPACT.format(r.latest_quantity)}
                      </span>{" "}
                      {r.asset_class === "cash"
                        ? r.native_currency
                        : r.asset_class === "crypto"
                          ? (r.symbol ?? "").toLowerCase()
                          : "shares"}
                    </>
                  ) : (
                    "—"
                  )}
                </div>
              </div>

              {/* Value */}
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <div className="font-display text-base font-bold tabular-nums">
                  {displayValue != null
                    ? formatMoney(displayValue, displayCurrency)
                    : "—"}
                </div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider">
                  {r.price_source === "manual"
                    ? "Cash"
                    : displayPrice != null
                      ? `@ ${formatMoney(displayPrice, displayCurrency)}`
                      : "No price yet"}
                  {usingNative && !sameCurrency && (
                    <span className="ml-1.5 text-loss/80 normal-case tracking-normal">
                      · native
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <EditAssetDrawer asset={editing} onClose={() => setEditing(null)} />
    </>
  );
}
