"use server";

import { createClient } from "@/lib/supabase/server";

export type TrendRange = "7d" | "1m" | "6m" | "1y" | "2y" | "5y";

export type TrendPoint = {
  date: string;
  total_base: number;
  is_backfilled: boolean;
};

export type RangeStatus =
  | { available: true; points: TrendPoint[] }
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
  "1m": 30,
  "6m": 180,
  "1y": 365,
  "2y": 730,
  "5y": 1825,
};

const RANGES: TrendRange[] = ["7d", "1m", "6m", "1y", "2y", "5y"];

/**
 * Read the user's net-worth trend across all six ranges in one shot.
 * Converts stored USD values to the user's `base_currency` using
 * `fx_rate_history` (forward-filled per date). Ranges remain viewable even
 * when some snapshots have low coverage; the backfill layer carries missing
 * prices flat so incomplete provider data does not blank the chart.
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
    .select("snapshot_date, total_usd, is_backfilled, coverage_pct")
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

  const allPoints: Array<TrendPoint & { coverage_pct: number }> = snaps.map(
    (s) => ({
      date: s.snapshot_date,
      total_base: round2(Number(s.total_usd) * rateFor(s.snapshot_date)),
      is_backfilled: s.is_backfilled,
      coverage_pct: Number(s.coverage_pct),
    }),
  );

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
    if (slice.length === 0) {
      series[r] = { available: false, reason: "no_data" };
      continue;
    }
    series[r] = {
      available: true,
      points: slice.map((p) => ({
        date: p.date,
        total_base: p.total_base,
        is_backfilled: p.is_backfilled,
      })),
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
