"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import type {
  RangeStatus,
  TrendRange,
} from "@/app/actions/net-worth-history";

const RANGES: { key: TrendRange; label: string }[] = [
  { key: "7d", label: "7D" },
  { key: "1m", label: "1M" },
  { key: "6m", label: "6M" },
  { key: "1y", label: "1Y" },
  { key: "2y", label: "2Y" },
  { key: "5y", label: "5Y" },
];

type Props = {
  series: Record<TrendRange, RangeStatus>;
  baseCurrency: string;
  onboardingDate: string | null;
  hasManualPricedAssets: boolean;
};

function formatCompact(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
}

function formatFull(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
}

function formatXTick(dateIso: string, range: TrendRange): string {
  const d = new Date(dateIso + "T00:00:00Z");
  if (range === "7d") {
    return d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  }
  if (range === "1m") {
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }
  if (range === "6m" || range === "1y") {
    return d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  }
  return d.toLocaleDateString("en-US", { year: "numeric", timeZone: "UTC" });
}

export function NetWorthTrendChart({
  series,
  baseCurrency,
  onboardingDate,
  hasManualPricedAssets,
}: Props) {
  // Pick a sensible initial range — first available, preferring 1y as the
  // default. Falls back to whatever's first if 1y isn't available.
  const defaultRange: TrendRange = useMemo(() => {
    const preferred: TrendRange[] = ["1y", "6m", "1m", "7d", "2y", "5y"];
    for (const r of preferred) {
      if (series[r].available) return r;
    }
    return "1y";
  }, [series]);

  const [range, setRange] = useState<TrendRange>(defaultRange);
  const [howOpen, setHowOpen] = useState(false);

  const status = series[range];
  // Memoize points so the yDomain useMemo below has a stable dependency.
  const points = useMemo(
    () => (status.available ? status.points : []),
    [status],
  );
  const emptyMessage =
    !status.available && status.reason === "insufficient_coverage"
      ? "Not enough price history for this range yet."
      : "No data for this range yet.";

  // Domain: only data within the selected range. Recharts handles auto Y.
  const yDomain = useMemo<[number | "auto", number | "auto"]>(() => {
    if (points.length === 0) return ["auto", "auto"];
    let min = Infinity;
    let max = -Infinity;
    for (const p of points) {
      if (p.total_base < min) min = p.total_base;
      if (p.total_base > max) max = p.total_base;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return ["auto", "auto"];
    const pad = Math.max((max - min) * 0.1, max * 0.02, 1);
    return [Math.max(0, min - pad), max + pad];
  }, [points]);

  // Tick selection — let recharts pick X ticks but cap the count so labels
  // don't overlap.
  const xTickCount = range === "7d" ? 7 : range === "1m" ? 6 : 6;

  return (
    <section className="relative flex flex-col gap-4 p-7 rounded-2xl bg-[#0A0A0A] border border-white/[0.08]">
      {/* --- Eyebrow + range pills --- */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-plex text-[11px] text-text-muted uppercase tracking-[0.18em] font-medium">
            Trend
          </span>
        </div>
        <div className="flex items-center gap-1 p-0.5 rounded-pill bg-black/40 border border-white/[0.08]">
          {RANGES.map(({ key, label }) => {
            const s = series[key];
            const disabled = !s.available;
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setRange(key)}
                title={
                  disabled
                    ? s.reason === "no_data"
                      ? "No data for this range yet."
                      : "Not enough price history for this range yet."
                    : undefined
                }
                className={cn(
                  "h-6 px-2.5 rounded-pill text-[11px] font-semibold font-plex transition-colors",
                  disabled
                    ? "text-text-muted/40 cursor-not-allowed"
                    : key === range
                      ? "bg-[#7FFFD4] text-black"
                      : "text-text-secondary hover:text-foreground",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* --- Chart body --- */}
      <div className="h-[200px] -mx-2">
        {points.length === 0 ? (
          <div className="h-full flex items-center justify-center font-plex text-[12px] text-text-muted">
            {emptyMessage}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={points}
              margin={{ top: 8, right: 12, left: 12, bottom: 4 }}
            >
              <XAxis
                dataKey="date"
                tickFormatter={(v: string) => formatXTick(v, range)}
                tick={{ fill: "#7a7a7a", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={32}
                tickCount={xTickCount}
              />
              <YAxis
                domain={yDomain}
                tickFormatter={(v: number) => formatCompact(v, baseCurrency)}
                tick={{ fill: "#7a7a7a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  background: "#0A0A0A",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8,
                  fontFamily:
                    "var(--font-plex), ui-monospace, SFMono-Regular, monospace",
                  fontSize: 12,
                }}
                labelStyle={{ color: "#7a7a7a" }}
                itemStyle={{ color: "#fff" }}
                labelFormatter={(label) =>
                  new Date(String(label) + "T00:00:00Z").toLocaleDateString(
                    "en-US",
                    {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    },
                  )
                }
                formatter={(value, _name, ctx) => {
                  const num = Number(value);
                  const payload = ctx?.payload as
                    | { is_backfilled?: boolean }
                    | undefined;
                  const tag = payload?.is_backfilled ? " (estimated)" : "";
                  return [
                    `${formatFull(num, baseCurrency)}${tag}`,
                    "Net worth",
                  ];
                }}
              />
              {onboardingDate && (
                <ReferenceLine
                  x={onboardingDate}
                  stroke="#7FFFD4"
                  strokeDasharray="2 4"
                  strokeOpacity={0.6}
                  label={{
                    value: "You joined",
                    position: "insideTopRight",
                    fill: "#7FFFD4",
                    fontSize: 10,
                    fontFamily: "var(--font-plex)",
                    opacity: 0.8,
                  }}
                />
              )}
              {/* Backfilled segment — dashed, muted */}
              <Line
                type="monotone"
                dataKey={(p: { total_base: number; is_backfilled: boolean }) =>
                  p.is_backfilled ? p.total_base : null
                }
                stroke="#7FFFD4"
                strokeWidth={2}
                strokeDasharray="4 4"
                strokeOpacity={0.55}
                dot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
              {/* Tracked segment — solid, full opacity */}
              <Line
                type="monotone"
                dataKey={(p: { total_base: number; is_backfilled: boolean }) =>
                  p.is_backfilled ? null : p.total_base
                }
                stroke="#7FFFD4"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* --- Footer --- */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => setHowOpen((v) => !v)}
          className="font-plex text-[11px] text-text-muted hover:text-text-secondary transition-colors underline-offset-2 hover:underline"
        >
          How this is calculated
        </button>
        <span className="font-plex text-[11px] text-text-muted/70">
          Values in {baseCurrency}
        </span>
      </div>

      {howOpen && (
        <div className="rounded-xl border border-white/[0.08] bg-black/40 p-4 flex flex-col gap-2 text-[12px] text-text-secondary leading-relaxed">
          <p>
            <span className="text-foreground">Solid line</span> — your actual
            tracked net worth, snapshotted daily.
          </p>
          <p>
            <span className="text-foreground">Dashed line</span> — estimate,
            before you started tracking.
          </p>
          <p className="text-text-muted">
            Estimates assume you held today&apos;s portfolio at the time, priced
            at historical market rates. Real past values may differ if your
            holdings changed.
          </p>
          {hasManualPricedAssets && (
            <p className="text-text-muted">
              Manually-priced assets are held flat in estimates.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
