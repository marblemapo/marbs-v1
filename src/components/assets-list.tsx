"use client";

import { useState } from "react";
import Image from "next/image";
import { EditAssetDrawer, type EditableAsset } from "@/components/edit-asset-drawer";

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

  return (
    <>
      <div className="flex flex-col rounded-lg bg-surface border border-border divide-y divide-border overflow-hidden">
        {rows.map((r) => (
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
                {r.value_native != null
                  ? formatMoney(r.value_native, r.native_currency)
                  : "—"}
              </div>
              <div className="text-[10px] text-text-muted uppercase tracking-wider">
                {r.price_source === "manual"
                  ? "Cash"
                  : r.latest_price != null
                    ? `@ ${formatMoney(r.latest_price, r.native_currency)}`
                    : "No price yet"}
              </div>
            </div>
          </button>
        ))}
      </div>

      <EditAssetDrawer asset={editing} onClose={() => setEditing(null)} />
    </>
  );
}
