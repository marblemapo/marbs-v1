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

  await admin
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

  await admin
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
}

/** Format a Date as ISO yyyy-mm-dd in UTC. */
export function isoDateUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}
