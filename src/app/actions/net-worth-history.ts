"use server";

import { createClient } from "@/lib/supabase/server";

export type TrendRange = "7d" | "2w" | "1m" | "6m" | "1y" | "2y" | "5y";

export type TrendValuationQuality =
  | "tracked"
  | "historical"
  | "partially_estimated"
  | "mostly_estimated"
  | "low_coverage";

export type TrendPoint = {
  date: string;
  total_base: number;
  is_backfilled: boolean;
  coverage_pct: number;
  estimated_pct: number;
  missing_price_pct: number;
  valuation_quality: TrendValuationQuality;
};

export type RangeQuality = {
  valuation_quality: TrendValuationQuality;
  coverage_pct: number;
  estimated_pct: number;
  missing_price_pct: number;
};

export type RangeStatus =
  | { available: true; points: TrendPoint[]; quality: RangeQuality }
  | { available: false; reason: "insufficient_coverage" | "no_data" };

export type NetWorthHistoryResult = {
  base_currency: string;
  /** Earliest non-backfilled snapshot date (when the user joined / first tracked). */
  onboarding_date: string | null;
  has_manual_priced_assets: boolean;
  series: Record<TrendRange, RangeStatus>;
  /** True when the user has no assets at all — card should be hidden entirely. */
  no_assets: boolean;
};

const RANGE_DAYS: Record<TrendRange, number> = {
  "7d": 7,
  "2w": 14,
  "1m": 30,
  "6m": 180,
  "1y": 365,
  "2y": 730,
  "5y": 1825,
};

const RANGES: TrendRange[] = ["7d", "2w", "1m", "6m", "1y", "2y", "5y"];

/**
 * Read the user's net-worth trend across all six ranges in one shot.
 * Converts stored USD values to the user's `base_currency` using
 * `fx_rate_history` (forward-filled per date). Ranges remain viewable even
 * when some snapshots have low coverage; the backfill layer now labels
 * incomplete provider data instead of flattening it across long ranges.
 */
export async function getNetWorthHistory(): Promise<NetWorthHistoryResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return emptyResult("USD", true);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("base_currency")
    .eq("id", user.id)
    .single();
  const baseCurrency = (profile?.base_currency ?? "USD").toUpperCase();

  // Detect whether the user has any assets and any manual-priced assets.
  const { data: allAssetRows } = await supabase
    .from("assets")
    .select("id, price_source")
    .eq("user_id", user.id);
  const hasAssets = (allAssetRows ?? []).length > 0;
  const has_manual_priced_assets = (allAssetRows ?? []).some(
    (a) => a.price_source === "manual",
  );

  if (!hasAssets) {
    // No portfolio — hero shows the empty state; hide the chart.
    return emptyResult(baseCurrency, true);
  }

  // Pull the last 5y of snapshots in one go. Even with daily granularity,
  // this is ~1825 rows max — small.
  const fiveYearsAgo = new Date(Date.now() - 1825 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const { data: snaps } = await supabase
    .from("net_worth_snapshots")
    .select(
      "snapshot_date, total_usd, is_backfilled, coverage_pct, breakdown_usd",
    )
    .eq("user_id", user.id)
    .gte("snapshot_date", fiveYearsAgo)
    .order("snapshot_date", { ascending: true });

  if (!snaps || snaps.length === 0) {
    // Assets exist but no snapshot rows yet — backfill is in progress.
    return emptyResult(baseCurrency, false);
  }

  // Earliest non-backfilled snapshot = "joined" marker.
  const tracked = snaps.filter((s) => !s.is_backfilled);
  const onboarding_date = tracked.length > 0 ? tracked[0].snapshot_date : null;

  // Build USD-> base FX series (forward-fill).
  let fxSeries: Array<{ date: string; rate: number }> = [];
  if (baseCurrency !== "USD") {
    const { data: fx } = await supabase
      .from("fx_rate_history")
      .select("observation_date, rate")
      .eq("base", "USD")
      .eq("quote", baseCurrency)
      .gte("observation_date", fiveYearsAgo)
      .order("observation_date", { ascending: true });
    fxSeries = (fx ?? []).map((r) => ({
      date: r.observation_date,
      rate: Number(r.rate),
    }));
  }

  function rateFor(date: string): number {
    if (baseCurrency === "USD") return 1;
    if (fxSeries.length === 0) return 1; // shouldn't happen, but safe fallback
    // Find the largest entry with date <= target. Forward-fill if no exact match.
    let lo = 0;
    let hi = fxSeries.length - 1;
    let best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (fxSeries[mid].date <= date) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (best === -1) return fxSeries[0].rate; // before earliest, use earliest
    return fxSeries[best].rate;
  }

  const allPoints: TrendPoint[] = snaps.map((s) => {
    const meta = qualityMetaFromBreakdown(s.breakdown_usd, {
      isBackfilled: s.is_backfilled,
      coveragePct: Number(s.coverage_pct),
    });
    return {
      date: s.snapshot_date,
      total_base: round2(Number(s.total_usd) * rateFor(s.snapshot_date)),
      is_backfilled: s.is_backfilled,
      coverage_pct: Number(s.coverage_pct),
      estimated_pct: meta.estimated_pct,
      missing_price_pct: meta.missing_price_pct,
      valuation_quality: meta.valuation_quality,
    };
  });

  // Slice each range. Do not blank an entire range just because some
  // historical provider data is incomplete; partial estimates are still more
  // useful than an empty card, and the chart copy explains the approximation.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const series = {} as Record<TrendRange, RangeStatus>;
  for (const r of RANGES) {
    const days = RANGE_DAYS[r];
    const cutoff = new Date(today.getTime() - days * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const slice = allPoints.filter((p) => p.date >= cutoff);
    if (slice.length < 2) {
      series[r] = { available: false, reason: "no_data" };
      continue;
    }
    series[r] = {
      available: true,
      points: slice,
      quality: summarizeRangeQuality(slice),
    };
  }

  return {
    base_currency: baseCurrency,
    onboarding_date,
    has_manual_priced_assets,
    series,
    no_assets: false,
  };
}

function emptyResult(
  baseCurrency: string,
  no_assets: boolean,
): NetWorthHistoryResult {
  const series = {} as Record<TrendRange, RangeStatus>;
  for (const r of RANGES) {
    series[r] = { available: false, reason: "no_data" };
  }
  return {
    base_currency: baseCurrency,
    onboarding_date: null,
    has_manual_priced_assets: false,
    series,
    no_assets,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function qualityMetaFromBreakdown(
  breakdown: unknown,
  fallback: { isBackfilled: boolean; coveragePct: number },
): RangeQuality {
  const maybeMeta =
    breakdown &&
    typeof breakdown === "object" &&
    "_meta" in breakdown &&
    (breakdown as { _meta?: unknown })._meta &&
    typeof (breakdown as { _meta?: unknown })._meta === "object"
      ? ((breakdown as { _meta?: Record<string, unknown> })._meta ?? null)
      : null;

  if (maybeMeta) {
    return {
      valuation_quality: normalizeQuality(maybeMeta.valuation_quality),
      coverage_pct: clampPct(fallback.coveragePct),
      estimated_pct: clampPct(Number(maybeMeta.estimated_pct ?? 0)),
      missing_price_pct: clampPct(Number(maybeMeta.missing_price_pct ?? 0)),
    };
  }

  const missingPct = clampPct(1 - fallback.coveragePct);
  return {
    valuation_quality:
      missingPct > 0.3
        ? "low_coverage"
        : fallback.isBackfilled
          ? "partially_estimated"
          : "tracked",
    coverage_pct: clampPct(fallback.coveragePct),
    estimated_pct: fallback.isBackfilled ? clampPct(1 - missingPct) : 0,
    missing_price_pct: missingPct,
  };
}

function summarizeRangeQuality(points: TrendPoint[]): RangeQuality {
  let coverage = 0;
  let estimated = 0;
  let missing = 0;
  let worstRank = -1;
  let worst: TrendValuationQuality = "historical";

  for (const p of points) {
    coverage += p.coverage_pct;
    estimated += p.estimated_pct;
    missing += p.missing_price_pct;
    const rank = qualityRank(p.valuation_quality);
    if (rank > worstRank) {
      worstRank = rank;
      worst = p.valuation_quality;
    }
  }

  const count = Math.max(points.length, 1);
  return {
    valuation_quality: worst,
    coverage_pct: roundPct(coverage / count),
    estimated_pct: roundPct(estimated / count),
    missing_price_pct: roundPct(missing / count),
  };
}

function normalizeQuality(value: unknown): TrendValuationQuality {
  if (
    value === "tracked" ||
    value === "historical" ||
    value === "partially_estimated" ||
    value === "mostly_estimated" ||
    value === "low_coverage"
  ) {
    return value;
  }
  return "partially_estimated";
}

function qualityRank(q: TrendValuationQuality): number {
  switch (q) {
    case "low_coverage":
      return 4;
    case "mostly_estimated":
      return 3;
    case "partially_estimated":
      return 2;
    case "tracked":
      return 1;
    case "historical":
      return 0;
  }
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function roundPct(n: number): number {
  return Math.round(n * 10000) / 10000;
}
