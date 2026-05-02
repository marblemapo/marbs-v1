/**
 * Net worth computation — shared between the dashboard, recompute hooks,
 * and the daily cron snapshot.
 *
 * `computeCurrentNetWorthUSD` returns the user's net worth right now,
 * denominated in USD. We store snapshots in USD so that switching the
 * user's `base_currency` doesn't require a recompute — we convert at read
 * time using `fx_rate_history`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchFxRates } from "@/lib/fx";
import { createAdminClient } from "@/lib/supabase/admin";
import { backfillPriceHistoryForAsset } from "@/lib/historical-prices";
import { backfillFxHistoryForCurrency } from "@/lib/historical-fx";

const BACKFILL_DAYS = 1825; // ~5 years

export type AssetClassKey = "equity" | "etf" | "crypto" | "cash";

export type NetWorthBreakdownUSD = Record<AssetClassKey, number>;

export type CurrentNetWorthSnapshot = {
  total_usd: number;
  breakdown_usd: NetWorthBreakdownUSD;
  /** Fraction of asset positions that resolved to a USD value. 1 = all priced. */
  coverage_pct: number;
};

const EMPTY_BREAKDOWN: NetWorthBreakdownUSD = {
  equity: 0,
  etf: 0,
  crypto: 0,
  cash: 0,
};

/**
 * Compute the user's current net worth in USD by reading the latest
 * balance snapshot per asset and joining with `price_cache` + live FX.
 *
 * The provided supabase client must be able to read the user's assets and
 * balance_snapshots. Pass an authenticated client for server actions, or
 * the admin client (with explicit user_id filtering) for cron.
 */
export async function computeCurrentNetWorthUSD(
  supabase: SupabaseClient,
  userId: string,
): Promise<CurrentNetWorthSnapshot> {
  const { data: assets } = await supabase
    .from("assets")
    .select("id, asset_class, native_currency, price_source, external_id")
    .eq("user_id", userId);

  if (!assets || assets.length === 0) {
    return { total_usd: 0, breakdown_usd: { ...EMPTY_BREAKDOWN }, coverage_pct: 1 };
  }

  const assetIds = assets.map((a) => a.id);

  const { data: snapshots } = await supabase
    .from("balance_snapshots")
    .select("asset_id, quantity, snapshot_at")
    .in("asset_id", assetIds)
    .order("snapshot_at", { ascending: false });

  const latestQty = new Map<string, number>();
  for (const s of snapshots ?? []) {
    if (!latestQty.has(s.asset_id)) latestQty.set(s.asset_id, Number(s.quantity));
  }

  const pricedAssets = assets.filter(
    (a) => a.external_id && a.price_source !== "manual",
  );
  const priceByKey = new Map<string, number>();
  if (pricedAssets.length) {
    const { data: prices } = await supabase
      .from("price_cache")
      .select("external_id, source, price_native")
      .in(
        "external_id",
        pricedAssets.map((a) => a.external_id!),
      );
    for (const p of prices ?? []) {
      priceByKey.set(`${p.external_id}|${p.source}`, Number(p.price_native));
    }
  }

  const currencies = Array.from(
    new Set(assets.map((a) => a.native_currency).concat("USD")),
  );
  const fxRates = currencies.length > 1 ? await fetchFxRates("USD", currencies) : null;

  const breakdown: NetWorthBreakdownUSD = { ...EMPTY_BREAKDOWN };
  let total = 0;
  let pricedPositions = 0;
  let totalPositions = 0;

  for (const a of assets) {
    const qty = latestQty.get(a.id);
    if (qty == null || qty === 0) continue;
    totalPositions += 1;

    let priceNative: number | null = null;
    if (a.price_source === "manual") {
      priceNative = 1;
    } else if (a.external_id) {
      priceNative = priceByKey.get(`${a.external_id}|${a.price_source}`) ?? null;
    } else if (a.asset_class === "cash") {
      priceNative = 1;
    }
    if (priceNative == null) continue;

    const valueNative = qty * priceNative;
    let valueUsd: number | null = null;
    if (a.native_currency === "USD") {
      valueUsd = valueNative;
    } else if (fxRates) {
      const rate = fxRates[a.native_currency.toUpperCase()];
      if (rate && rate > 0) {
        // fetchFxRates returns rates as 1 USD = X quote — invert to convert quote → USD.
        valueUsd = valueNative / rate;
      }
    }
    if (valueUsd == null) continue;

    pricedPositions += 1;
    breakdown[a.asset_class as AssetClassKey] =
      (breakdown[a.asset_class as AssetClassKey] ?? 0) + valueUsd;
    total += valueUsd;
  }

  const coverage_pct = totalPositions === 0 ? 1 : pricedPositions / totalPositions;

  return {
    total_usd: round2(total),
    breakdown_usd: {
      equity: round2(breakdown.equity),
      etf: round2(breakdown.etf),
      crypto: round2(breakdown.crypto),
      cash: round2(breakdown.cash),
    },
    coverage_pct: roundPct(coverage_pct),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function roundPct(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Upsert today's net_worth_snapshots row for a user. Idempotent — safe to
 * call from concurrent paths (multiple asset mutations in flight). Always
 * writes via admin client (the table is service-role-write only).
 *
 * Called from:
 *   - `after()` inside addAsset / updateAssetQuantity / deleteAsset
 *   - Daily cron route
 */
export async function upsertTodaySnapshot(userId: string): Promise<void> {
  const admin = createAdminClient();
  const snapshot = await computeCurrentNetWorthUSD(admin, userId);

  const today = isoDateUTC(new Date());

  const { error } = await admin
    .from("net_worth_snapshots")
    .upsert(
      {
        user_id: userId,
        snapshot_date: today,
        total_usd: snapshot.total_usd,
        breakdown_usd: snapshot.breakdown_usd,
        is_backfilled: false,
        coverage_pct: snapshot.coverage_pct,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,snapshot_date" },
    );
  if (error) {
    console.error(
      `[net-worth] upsertTodaySnapshot failed for ${userId}:`,
      error.message,
    );
    throw new Error(error.message);
  }
}

/**
 * Insert a snapshot for a specific date (used by the cron to fill yesterday).
 * Skips if a non-backfilled row already exists for that date — we never
 * overwrite a real tracked snapshot.
 */
export async function upsertSnapshotForDate(
  userId: string,
  date: Date,
): Promise<void> {
  const admin = createAdminClient();
  const snapshot = await computeCurrentNetWorthUSD(admin, userId);
  const dateIso = isoDateUTC(date);

  const { data: existing } = await admin
    .from("net_worth_snapshots")
    .select("is_backfilled")
    .eq("user_id", userId)
    .eq("snapshot_date", dateIso)
    .maybeSingle();

  // Don't clobber a real tracked snapshot. Backfilled rows can be replaced.
  if (existing && existing.is_backfilled === false) return;

  const { error } = await admin
    .from("net_worth_snapshots")
    .upsert(
      {
        user_id: userId,
        snapshot_date: dateIso,
        total_usd: snapshot.total_usd,
        breakdown_usd: snapshot.breakdown_usd,
        is_backfilled: false,
        coverage_pct: snapshot.coverage_pct,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,snapshot_date" },
    );
  if (error) {
    console.error(
      `[net-worth] upsertSnapshotForDate failed for ${userId}/${dateIso}:`,
      error.message,
    );
    throw new Error(error.message);
  }
}

/** Format a Date as ISO yyyy-mm-dd in UTC. */
export function isoDateUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Backfill / synthetic-snapshot compute
// ---------------------------------------------------------------------------

type AssetForBackfill = {
  id: string;
  external_id: string | null;
  symbol: string | null;
  asset_class: AssetClassKey;
  native_currency: string;
  price_source: "yahoo" | "coingecko" | "finnhub" | "manual";
};

/**
 * Backfill the user's full history. Two phases:
 *
 *   1. EXTERNAL FETCH — populate `price_history` and `fx_rate_history` for
 *      every asset / currency the user holds, going back ~5 years.
 *   2. SYNTHETIC COMPUTE — for each day in the range, compute net worth
 *      using today's holdings × that day's prices/FX, write to
 *      `net_worth_snapshots` with is_backfilled=true.
 *
 * Idempotent: re-running skips already-cached price/FX rows and uses
 * `on conflict do nothing` for snapshots so real (non-backfilled) rows are
 * never overwritten. Best-effort per asset — one failed fetch doesn't
 * poison the rest.
 */
export async function backfillUserHistory(userId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: assetsRaw } = await admin
    .from("assets")
    .select("id, external_id, symbol, asset_class, native_currency, price_source")
    .eq("user_id", userId);
  const assets = (assetsRaw ?? []) as AssetForBackfill[];
  if (assets.length === 0) return;

  // Phase 1: fetch missing price + FX history. Run all fetches in parallel
  // — each fetcher has its own 36h cache gate so re-runs are cheap, and
  // parallelizing keeps total wall time under Vercel's function timeout
  // even on Hobby (max 60s).
  const priceFetches = assets
    .filter(
      (a) =>
        a.external_id &&
        a.price_source !== "manual" &&
        a.asset_class !== "cash",
    )
    .map((a) =>
      backfillPriceHistoryForAsset(admin, {
        external_id: a.external_id!,
        source: a.price_source,
        native_currency: a.native_currency,
        symbol: a.symbol,
        asset_class: a.asset_class,
      }).catch((e) => {
        console.error(
          `[backfill] price fetch failed for ${a.external_id}:`,
          e instanceof Error ? e.message : String(e),
        );
        return { inserted: 0, oldestDate: null };
      }),
    );

  const currencies = Array.from(
    new Set(assets.map((a) => a.native_currency.toUpperCase())),
  ).filter((c) => c !== "USD");
  const fxFetches = currencies.map((c) =>
    backfillFxHistoryForCurrency(admin, c).catch((e) => {
      console.error(
        `[backfill] FX fetch failed for ${c}:`,
        e instanceof Error ? e.message : String(e),
      );
      return { inserted: 0, oldestDate: null };
    }),
  );

  const phaseOneResults = await Promise.all([...priceFetches, ...fxFetches]);

  // Guard: if the portfolio contains priced assets but Phase 1 produced zero
  // rows (external APIs all failed / timed out / blocked), skip Phase 2.
  // Without this guard, Phase 2 would insert ~1825 rows with total_usd=0 and
  // coverage_pct=0, which (a) pollutes the DB and (b) pushes backfilledCount
  // above the retry threshold so the next dashboard load never re-triggers.
  const hasPricedAssets = assets.some(
    (a) =>
      a.external_id &&
      a.price_source !== "manual" &&
      a.asset_class !== "cash",
  );
  if (hasPricedAssets) {
    const priceRowsInserted = phaseOneResults
      .slice(0, priceFetches.length)
      .reduce((sum, r) => sum + r.inserted, 0);
    // If inserted === 0 for all assets, check whether price_history already
    // has data (could be a cache-hit run, not necessarily a failure).
    if (priceRowsInserted === 0) {
      const sampleAsset = assets.find(
        (a) =>
          a.external_id &&
          a.price_source !== "manual" &&
          a.asset_class !== "cash",
      )!;
      const { count } = await admin
        .from("price_history")
        .select("*", { count: "exact", head: true })
        .eq("external_id", sampleAsset.external_id!)
        .eq("source", sampleAsset.price_source)
        .limit(1);
      if ((count ?? 0) === 0) {
        // External fetch genuinely failed — no price data available.
        // Skip Phase 2 so net_worth_snapshots stays empty and the dashboard
        // trigger will retry on the next load.
        console.warn(
          `[backfill] Phase 1 produced no price data for ${userId}; skipping Phase 2`,
        );
        return;
      }
    }
  }

  // Phase 2: compute synthetic snapshots from local data.
  await recomputeBackfillRange(userId);
}

/**
 * Recompute the user's backfilled (synthetic) snapshots from existing
 * price_history + fx_rate_history. Does NOT re-fetch external data.
 *
 * Called when the portfolio changes — `addAsset`, `updateAssetQuantity`,
 * `deleteAsset`, wallet sync — so the dashed-line portion of the chart
 * reflects the latest "today's holdings".
 */
export async function recomputeBackfillRange(userId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: assetsRaw } = await admin
    .from("assets")
    .select("id, external_id, symbol, asset_class, native_currency, price_source")
    .eq("user_id", userId);
  const assets = (assetsRaw ?? []) as AssetForBackfill[];
  if (assets.length === 0) {
    // No portfolio → nothing to backfill. Drop any stale backfilled rows.
    await admin
      .from("net_worth_snapshots")
      .delete()
      .eq("user_id", userId)
      .eq("is_backfilled", true);
    return;
  }

  // Latest quantity per asset (constant-quantity assumption for backfill).
  const assetIds = assets.map((a) => a.id);
  const { data: snaps } = await admin
    .from("balance_snapshots")
    .select("asset_id, quantity, snapshot_at")
    .in("asset_id", assetIds)
    .order("snapshot_at", { ascending: false });
  const latestQty = new Map<string, number>();
  for (const s of snaps ?? []) {
    if (!latestQty.has(s.asset_id)) latestQty.set(s.asset_id, Number(s.quantity));
  }

  // Determine the onboarding cutoff — the earliest snapshot_at across all
  // assets. The synthetic range spans (today - 5y) up to (cutoff - 1).
  let onboardingDate: Date | null = null;
  for (const s of snaps ?? []) {
    const d = new Date(s.snapshot_at);
    if (!onboardingDate || d < onboardingDate) onboardingDate = d;
  }
  if (!onboardingDate) return;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const startDate = new Date(today.getTime() - BACKFILL_DAYS * 86_400_000);
  const endDate = new Date(onboardingDate);
  endDate.setUTCHours(0, 0, 0, 0);
  endDate.setUTCDate(endDate.getUTCDate() - 1);

  if (endDate.getTime() < startDate.getTime()) {
    // User onboarded ≥ 5y ago — nothing to backfill before their data.
    await admin
      .from("net_worth_snapshots")
      .delete()
      .eq("user_id", userId)
      .eq("is_backfilled", true);
    return;
  }

  // Load all relevant price_history rows.
  const externalIds = assets
    .map((a) => a.external_id)
    .filter((x): x is string => x != null);

  const priceSeriesByAsset = new Map<string, Array<{ date: string; price: number }>>();
  if (externalIds.length) {
    const { data: ph } = await admin
      .from("price_history")
      .select("external_id, source, observation_date, price_native")
      .in("external_id", externalIds)
      .order("observation_date", { ascending: true });
    for (const row of ph ?? []) {
      const key = `${row.external_id}|${row.source}`;
      const arr = priceSeriesByAsset.get(key) ?? [];
      arr.push({
        date: row.observation_date,
        price: Number(row.price_native),
      });
      priceSeriesByAsset.set(key, arr);
    }
  }

  // Load FX history for each non-USD currency.
  const fxSeriesByCurrency = new Map<string, Array<{ date: string; rate: number }>>();
  const currencies = Array.from(
    new Set(assets.map((a) => a.native_currency.toUpperCase())),
  ).filter((c) => c !== "USD");
  if (currencies.length) {
    const { data: fx } = await admin
      .from("fx_rate_history")
      .select("quote, observation_date, rate")
      .eq("base", "USD")
      .in("quote", currencies)
      .order("observation_date", { ascending: true });
    for (const row of fx ?? []) {
      const arr = fxSeriesByCurrency.get(row.quote) ?? [];
      arr.push({ date: row.observation_date, rate: Number(row.rate) });
      fxSeriesByCurrency.set(row.quote, arr);
    }
  }

  // Today's USD value per asset — denominator for coverage_pct. Resolves
  // per-asset (computeCurrentNetWorthUSD only returns aggregates) using the
  // same price_cache + FX-spot logic.
  const todayUsdByAsset = new Map<string, number>();
  const { data: priceCache } = await admin
    .from("price_cache")
    .select("external_id, source, price_native")
    .in("external_id", externalIds.length ? externalIds : ["__none__"]);
  const currentPriceByKey = new Map<string, number>();
  for (const p of priceCache ?? []) {
    currentPriceByKey.set(`${p.external_id}|${p.source}`, Number(p.price_native));
  }
  const fxRatesNow =
    currencies.length > 0
      ? await fetchFxRates("USD", [...currencies, "USD"])
      : null;

  for (const a of assets) {
    const qty = latestQty.get(a.id) ?? 0;
    if (qty === 0) continue;
    let priceNative: number | null = null;
    if (a.price_source === "manual") priceNative = 1;
    else if (a.external_id) {
      priceNative = currentPriceByKey.get(`${a.external_id}|${a.price_source}`) ?? null;
    } else if (a.asset_class === "cash") priceNative = 1;

    if (priceNative == null) continue;
    const valueNative = qty * priceNative;
    let usd: number | null = null;
    const cur = a.native_currency.toUpperCase();
    if (cur === "USD") usd = valueNative;
    else if (fxRatesNow) {
      const r = fxRatesNow[cur];
      if (r && r > 0) usd = valueNative / r;
    }
    if (usd != null) todayUsdByAsset.set(a.id, usd);
  }
  const totalTodayUsd = Array.from(todayUsdByAsset.values()).reduce(
    (a, b) => a + b,
    0,
  );

  // Iterate days, compute synthetic snapshots.
  const synthetic: Array<{
    user_id: string;
    snapshot_date: string;
    total_usd: number;
    breakdown_usd: NetWorthBreakdownUSD;
    coverage_pct: number;
    is_backfilled: true;
    computed_at: string;
  }> = [];

  // Pre-build forward-fill iterators per asset/currency: we step days
  // monotonically and advance pointers in each series.
  type Iter = { idx: number; series: Array<{ date: string; [k: string]: unknown }> };
  const priceIters = new Map<string, Iter>();
  for (const [key, series] of priceSeriesByAsset.entries()) {
    priceIters.set(key, { idx: -1, series });
  }
  const fxIters = new Map<string, Iter>();
  for (const [cur, series] of fxSeriesByCurrency.entries()) {
    fxIters.set(cur, { idx: -1, series });
  }

  function valueAtOrBefore(it: Iter, dateIso: string): number | null {
    while (
      it.idx + 1 < it.series.length &&
      it.series[it.idx + 1].date <= dateIso
    ) {
      it.idx += 1;
    }
    if (it.idx < 0) return null;
    const row = it.series[it.idx];
    if ("price" in row) return row.price as number;
    if ("rate" in row) return row.rate as number;
    return null;
  }

  // Iterate with sparse stepping to keep the total row count small (~95 rows
  // vs ~1825 with a naive daily loop).  Granularity per age:
  //   > 6 months ago  →  monthly  (1st of each calendar month; serves 1y/2y/5y)
  //   6m – 30d ago    →  bi-weekly (+14 days; serves 6m)
  //   last 30 days    →  daily    (+1 day;   serves 7d/1m)
  const d = new Date(startDate);
  while (d.getTime() <= endDate.getTime()) {
    const dateIso = isoDateUTC(d);
    const breakdown: NetWorthBreakdownUSD = { ...EMPTY_BREAKDOWN };
    let totalUsd = 0;
    let coveredUsd = 0;

    for (const a of assets) {
      const qty = latestQty.get(a.id) ?? 0;
      if (qty === 0) continue;
      const todayUsd = todayUsdByAsset.get(a.id) ?? 0;

      let priceNative: number | null = null;
      if (a.price_source === "manual") {
        // Manual-priced: hold flat at today's value (case C in plan).
        priceNative = 1;
      } else if (a.asset_class === "cash") {
        priceNative = 1;
      } else if (a.external_id) {
        const it = priceIters.get(`${a.external_id}|${a.price_source}`);
        if (it) priceNative = valueAtOrBefore(it, dateIso);
      }
      if (priceNative == null) continue;

      const valueNative = qty * priceNative;
      let usd: number | null = null;
      const cur = a.native_currency.toUpperCase();
      if (cur === "USD") usd = valueNative;
      else {
        const it = fxIters.get(cur);
        if (it) {
          const rate = valueAtOrBefore(it, dateIso);
          if (rate && rate > 0) usd = valueNative / rate;
        }
        // Fallback: when historical FX data is unavailable for this date (the
        // Frankfurter/Yahoo fetch failed or hasn't populated yet), use today's
        // spot rate. The absolute value is approximate but the trend shape —
        // driven by price changes — remains correct.  Without this fallback the
        // asset is excluded from both `totalUsd` and `coveredUsd`, setting
        // coverage_pct = 0 and hiding every chart range behind the
        // "insufficient_coverage" gate.
        if (usd == null && fxRatesNow) {
          const spotRate = fxRatesNow[cur];
          if (spotRate && spotRate > 0) usd = valueNative / spotRate;
        }
      }
      if (usd == null) continue;

      breakdown[a.asset_class] = (breakdown[a.asset_class] ?? 0) + usd;
      totalUsd += usd;
      coveredUsd += todayUsd;
    }

    const coverage_pct =
      totalTodayUsd > 0 ? Math.min(1, coveredUsd / totalTodayUsd) : 1;

    synthetic.push({
      user_id: userId,
      snapshot_date: dateIso,
      total_usd: round2(totalUsd),
      breakdown_usd: {
        equity: round2(breakdown.equity),
        etf: round2(breakdown.etf),
        crypto: round2(breakdown.crypto),
        cash: round2(breakdown.cash),
      },
      coverage_pct: roundPct(coverage_pct),
      is_backfilled: true,
      computed_at: new Date().toISOString(),
    });

    // Advance to next sample date based on how old this date is.
    const ageDays = (today.getTime() - d.getTime()) / 86_400_000;
    if (ageDays > 180) {
      // Monthly: jump to 1st of next calendar month.
      d.setUTCMonth(d.getUTCMonth() + 1, 1);
    } else if (ageDays > 30) {
      // Bi-weekly.
      d.setUTCDate(d.getUTCDate() + 14);
    } else {
      // Daily.
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }

  // Replace existing backfilled rows for this user with the fresh compute.
  // We never touch is_backfilled=false rows (real tracked snapshots).
  const { error: deleteErr } = await admin
    .from("net_worth_snapshots")
    .delete()
    .eq("user_id", userId)
    .eq("is_backfilled", true);
  if (deleteErr) {
    console.error(
      `[backfill] delete failed for ${userId}:`,
      deleteErr.message,
    );
    throw new Error(deleteErr.message);
  }

  if (synthetic.length === 0) return;

  // Insert NEWEST rows first. If a timeout kills us mid-insert, the user
  // still sees the most-recent chart ranges (7d, 1m, …) rather than only
  // ancient history from 5 years ago.
  const ordered = [...synthetic].reverse();

  const CHUNK = 500;
  let totalInserted = 0;
  for (let i = 0; i < ordered.length; i += CHUNK) {
    const slice = ordered.slice(i, i + CHUNK);
    const { error, count } = await admin
      .from("net_worth_snapshots")
      .upsert(slice, {
        onConflict: "user_id,snapshot_date",
        ignoreDuplicates: true, // never overwrite a real (non-backfilled) row
        count: "exact",
      });
    if (error) {
      console.error(
        `[backfill] insert failed at chunk ${i}/${ordered.length} for ${userId}:`,
        error.message,
      );
      throw new Error(error.message);
    }
    totalInserted += count ?? slice.length;
  }
  console.log(
    `[backfill] inserted ${totalInserted}/${ordered.length} backfilled rows for ${userId}`,
  );
}
