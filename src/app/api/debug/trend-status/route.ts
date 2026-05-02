import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Diagnostic endpoint — shows exactly what's in the DB that drives the
 * trend chart, so we can see why ranges are disabled.
 *
 * GET /api/debug/trend-status   (must be signed in)
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "not signed in" }, { status: 401 });
  }

  const admin = createAdminClient();

  // 1. snapshot counts + coverage sample
  const { data: snaps, count: snapCount } = await supabase
    .from("net_worth_snapshots")
    .select("snapshot_date, total_usd, is_backfilled, coverage_pct", {
      count: "exact",
    })
    .eq("user_id", user.id)
    .order("snapshot_date", { ascending: false })
    .limit(5);

  const { data: oldest } = await supabase
    .from("net_worth_snapshots")
    .select("snapshot_date, total_usd, coverage_pct")
    .eq("user_id", user.id)
    .order("snapshot_date", { ascending: true })
    .limit(3);

  // 2. coverage distribution (how many rows have coverage < 0.7)
  const { count: lowCoverageCount } = await supabase
    .from("net_worth_snapshots")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .lt("coverage_pct", 0.7);

  // 3. user's assets + what's in price_history per asset
  const { data: assets } = await admin
    .from("assets")
    .select("id, symbol, external_id, asset_class, price_source, native_currency")
    .eq("user_id", user.id);

  const priceHistoryCounts: Record<string, number> = {};
  for (const a of assets ?? []) {
    if (!a.external_id || a.price_source === "manual") continue;
    const { count } = await admin
      .from("price_history")
      .select("*", { count: "exact", head: true })
      .eq("external_id", a.external_id)
      .eq("source", a.price_source);
    priceHistoryCounts[`${a.symbol ?? a.external_id} (${a.price_source})`] =
      count ?? 0;
  }

  // 4. FX history counts per currency
  const currencies = Array.from(
    new Set((assets ?? []).map((a) => a.native_currency.toUpperCase())),
  ).filter((c) => c !== "USD");
  const fxHistoryCounts: Record<string, number> = {};
  for (const c of currencies) {
    const { count } = await admin
      .from("fx_rate_history")
      .select("*", { count: "exact", head: true })
      .eq("base", "USD")
      .eq("quote", c);
    fxHistoryCounts[c] = count ?? 0;
  }

  // 5. balance_snapshots presence
  const assetIds = (assets ?? []).map((a) => a.id);
  const { count: balanceSnapCount } = await admin
    .from("balance_snapshots")
    .select("*", { count: "exact", head: true })
    .in("asset_id", assetIds.length ? assetIds : ["__none__"]);

  return Response.json({
    user_id: user.id,
    snapshots: {
      total: snapCount ?? 0,
      low_coverage_count: lowCoverageCount ?? 0,
      recent_5: snaps,
      oldest_3: oldest,
    },
    assets: assets?.map((a) => ({
      symbol: a.symbol,
      external_id: a.external_id,
      asset_class: a.asset_class,
      price_source: a.price_source,
      native_currency: a.native_currency,
    })),
    price_history_counts: priceHistoryCounts,
    fx_history_counts: fxHistoryCounts,
    balance_snapshot_count: balanceSnapCount ?? 0,
  });
}
