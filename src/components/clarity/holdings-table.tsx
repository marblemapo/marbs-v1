"use client";

import { useMemo } from "react";
import { convertFx } from "@/lib/fx";
import { useCurrency } from "@/components/currency-context";
import type { HoldingsRow } from "@/lib/holdings-report";

// Clarity Holdings table (spec 2a bottom section) — 6-column grid with per-row
// direction sparklines. Sparklines are synthesised from today's delta sign
// (up / down / flat), NOT from real 7-day per-asset history — that requires a
// per-asset price-history fetch that isn't in the schema yet. Follow-up:
// wire real 7-day series.

const CLASS_STYLE: Record<string, { bg: string; color: string }> = {
  crypto: { bg: "#f7931a22", color: "#f7931a" },
  equity: { bg: "#ffffff12", color: "#e6e7ea" },
  etf: { bg: "#3aa0ff22", color: "#3aa0ff" },
  cash: { bg: "#f5c51822", color: "#f5c518" },
};

const SPARK_UP = "M0,18 L12,14 L24,16 L36,8 L48,11 L60,3";
const SPARK_DOWN = "M0,7 L12,10 L24,8 L36,15 L48,12 L60,17";
const SPARK_FLAT = "M0,12 L60,12";

const COLS = "2.2fr 1.2fr 1fr 1fr 1.2fr 1fr";

function fmtMoney(value: number, currency: string) {
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

function fmtQty(qty: number | null) {
  if (qty == null) return "—";
  if (qty >= 1000)
    return qty.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (qty >= 1)
    return qty.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return qty.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

export function HoldingsTable({ rows }: { rows: HoldingsRow[] }) {
  const { currency, fxRates } = useCurrency();

  const enriched = useMemo(() => {
    const priced = rows.filter((r) => r.value_native != null);
    return priced.map((r) => {
      const conv = (v: number | null) => {
        if (v == null) return null;
        if (r.native_currency === currency) return v;
        if (!fxRates) return null;
        return convertFx(v, r.native_currency, currency, fxRates);
      };
      const cur = conv(r.value_native);
      const prev = conv(r.previous_value_native);
      const priceDisp = conv(r.latest_price);
      const todayPct =
        cur != null && prev != null && prev > 0
          ? ((cur - prev) / prev) * 100
          : null;
      return { ...r, cur, priceDisp, todayPct };
    });
  }, [rows, currency, fxRates]);

  if (enriched.length === 0) {
    return (
      <section className="clarity-card px-6 py-8 text-center">
        <div className="text-sm text-[#7d8085]">
          No holdings yet. Add one from the topbar.
        </div>
      </section>
    );
  }

  return (
    <section className="clarity-card max-md:bg-transparent max-md:border-0 max-md:shadow-none max-md:[backdrop-filter:none] max-md:rounded-none px-0 md:px-1 py-0 md:py-1.5">
      <div className="flex items-center justify-between px-1 md:px-[22px] pt-0 md:pt-4 pb-3">
        <span className="font-display font-bold text-[17px] md:text-base text-white">
          Holdings
        </span>
        <span className="text-[13px] text-[#00E5A0] md:text-[#7d8085] font-semibold md:font-normal">
          {enriched.length} asset{enriched.length === 1 ? "" : "s"}
        </span>
      </div>
      <div
        className="hidden md:grid px-[22px] pb-2.5 text-[12px] text-[#7d8085] border-b border-white/[0.06]"
        style={{ gridTemplateColumns: COLS }}
      >
        <span>Asset</span>
        <span className="text-right">Price</span>
        <span className="text-right">Holdings</span>
        <span className="text-right">Today</span>
        <span className="text-right">Value</span>
        <span className="text-right">7d</span>
      </div>
      {enriched.map((r, idx) => {
        const cls = CLASS_STYLE[r.asset_class] ?? CLASS_STYLE.equity;
        const dir =
          r.todayPct == null
            ? "flat"
            : r.todayPct > 0.05
              ? "up"
              : r.todayPct < -0.05
                ? "down"
                : "flat";
        const sparkPath =
          dir === "up" ? SPARK_UP : dir === "down" ? SPARK_DOWN : SPARK_FLAT;
        const sparkColor =
          dir === "up" ? "#00E5A0" : dir === "down" ? "#FF5000" : "#3a3d42";
        const todayColor =
          r.todayPct == null
            ? "#7d8085"
            : r.todayPct >= 0
              ? "#00E5A0"
              : "#FF5000";
        const isLast = idx === enriched.length - 1;

        const iconTile = (
          <span
            className="w-10 h-10 md:w-9 md:h-9 shrink-0 rounded-[12px] md:rounded-[11px] flex items-center justify-center font-display font-bold text-[15px] md:text-[13px] overflow-hidden"
            style={{ background: cls.bg, color: cls.color }}
          >
            {r.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.logo}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              (r.symbol ?? r.name).slice(0, 3).toUpperCase()
            )}
          </span>
        );

        return (
          <div key={r.id}>
            {/* Mobile card row */}
            <div className="flex md:hidden items-center gap-[13px] px-4 py-[14px] rounded-[20px] bg-[#141618] mb-[10px]">
              {iconTile}
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-white truncate">{r.name}</div>
                <div className="text-[12px] text-[#7d8085] font-mono">{r.symbol ?? r.asset_class}</div>
              </div>
              <svg width="46" height="22" viewBox="0 0 46 22" className="shrink-0" aria-hidden>
                <path d={sparkPath} fill="none" stroke={sparkColor} strokeWidth="2" />
              </svg>
              <div className="text-right min-w-[74px]">
                <div className="font-display font-bold text-white text-[15px] tabular-nums">
                  {r.cur != null ? fmtMoney(r.cur, currency) : "—"}
                </div>
                <div className="text-[12px] tabular-nums" style={{ color: todayColor }}>
                  {r.todayPct != null
                    ? `${r.todayPct >= 0 ? "+" : ""}${r.todayPct.toFixed(1)}%`
                    : "—"}
                </div>
              </div>
            </div>
            {/* Desktop table row */}
            <div
              className={`hidden md:grid items-center px-[22px] py-4 ${
                !isLast ? "border-b border-white/[0.05]" : ""
              }`}
              style={{ gridTemplateColumns: COLS }}
            >
              <span className="flex items-center gap-3 min-w-0">
                {iconTile}
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white truncate">
                    {r.name}
                  </span>
                  <span className="block text-[12px] text-[#7d8085] font-mono">
                    {r.symbol ?? r.asset_class}
                  </span>
                </span>
              </span>
              <span className="text-right font-display font-bold text-white tabular-nums">
                {r.priceDisp != null ? fmtMoney(r.priceDisp, currency) : "—"}
              </span>
              <span className="text-right font-mono text-[13px] text-[#c3c5c9]">
                {fmtQty(r.latest_quantity)}
              </span>
              <span
                className="text-right font-semibold tabular-nums"
                style={{ color: todayColor }}
              >
                {r.todayPct != null
                  ? `${r.todayPct >= 0 ? "+" : ""}${r.todayPct.toFixed(1)}%`
                  : "—"}
              </span>
              <span className="text-right font-display font-bold text-white tabular-nums">
                {r.cur != null ? fmtMoney(r.cur, currency) : "—"}
              </span>
              <span className="text-right">
                <svg
                  width="60"
                  height="24"
                  viewBox="0 0 60 24"
                  className="inline-block"
                  aria-hidden
                >
                  <path
                    d={sparkPath}
                    fill="none"
                    stroke={sparkColor}
                    strokeWidth="2"
                  />
                </svg>
              </span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
