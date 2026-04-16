import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { AddAssetDrawer } from "@/components/add-asset-drawer";
import { DisplayNameEditor } from "@/components/display-name-editor";
import { AssetsList, type AssetListRow } from "@/components/assets-list";
import { NetWorthHero } from "@/components/networth-hero";
import { CurrencyProvider } from "@/components/currency-context";
import { fetchFxRates, convertFx } from "@/lib/fx";

// Force dynamic — this page always reads live user + asset data.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Profile (base currency, display name).
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, base_currency, created_at")
    .eq("id", user.id)
    .single();

  const baseCurrency = profile?.base_currency ?? "USD";

  // Assets with latest balance + cached price.
  // Single query: assets LEFT JOIN latest snapshot per asset + price_cache.
  // For simplicity we fetch separately and stitch — small N for v1.
  const { data: assets } = await supabase
    .from("assets")
    .select(
      "id, name, symbol, asset_class, native_currency, price_source, external_id, metadata",
    )
    .order("created_at", { ascending: false });

  const assetIds = (assets ?? []).map((a) => a.id);

  // Pull the latest quantity per asset via a window-function-style query.
  // Supabase doesn't let us do window fns in PostgREST, so fetch all
  // snapshots and pick latest client-side. For v1 (handful of assets) this
  // is fine; optimize later with a DB view if it gets slow.
  const { data: snapshots } = assetIds.length
    ? await supabase
        .from("balance_snapshots")
        .select("asset_id, quantity, snapshot_at")
        .in("asset_id", assetIds)
        .order("snapshot_at", { ascending: false })
    : { data: [] as { asset_id: string; quantity: number; snapshot_at: string }[] };

  const latestByAsset = new Map<string, number>();
  for (const snap of snapshots ?? []) {
    if (!latestByAsset.has(snap.asset_id)) {
      latestByAsset.set(snap.asset_id, Number(snap.quantity));
    }
  }

  // Price cache lookup (public-read, so user session can read it).
  const priceKeys = (assets ?? [])
    .filter((a) => a.external_id && a.price_source !== "manual")
    .map((a) => ({ external_id: a.external_id!, source: a.price_source }));

  const priceByKey = new Map<string, number>();
  if (priceKeys.length) {
    const { data: prices } = await supabase
      .from("price_cache")
      .select("external_id, source, price_native")
      .in(
        "external_id",
        priceKeys.map((k) => k.external_id),
      );
    for (const p of prices ?? []) {
      priceByKey.set(`${p.external_id}|${p.source}`, Number(p.price_native));
    }
  }

  const rows: AssetListRow[] = (assets ?? []).map((a) => {
    const latest_quantity = latestByAsset.get(a.id) ?? null;
    const latest_price = a.external_id
      ? priceByKey.get(`${a.external_id}|${a.price_source}`) ?? null
      : a.price_source === "manual"
        ? 1
        : null;
    const meta = (a.metadata ?? {}) as Record<string, unknown>;
    const logo =
      typeof meta.logo === "string" && meta.logo.length > 0 ? meta.logo : null;
    return {
      id: a.id,
      name: a.name,
      symbol: a.symbol,
      asset_class: a.asset_class,
      native_currency: a.native_currency,
      price_source: a.price_source,
      latest_quantity,
      latest_price,
      logo,
      value_native:
        latest_quantity != null && latest_price != null
          ? latest_quantity * latest_price
          : null,
    };
  });

  // Fetch FX rates for every currency present in the holdings plus the base.
  // fetchFxRates always returns base as 1, others relative to base. Cached 6h.
  const currencySet = new Set<string>([baseCurrency]);
  for (const r of rows) currencySet.add(r.native_currency);
  const currencies = Array.from(currencySet);
  const fxRates = await fetchFxRates(baseCurrency, currencies);

  // Sort by base-currency-equivalent value, most valuable first. Rows with
  // no price / no FX (null value) slide to the bottom so the list still
  // puts real money at the top.
  const baseValue = (r: (typeof rows)[number]): number | null => {
    if (r.value_native == null) return null;
    if (r.native_currency === baseCurrency) return r.value_native;
    if (!fxRates) return null;
    return convertFx(r.value_native, r.native_currency, baseCurrency, fxRates);
  };
  const rowsWithValue = [...rows].sort((a, b) => {
    const av = baseValue(a);
    const bv = baseValue(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1; // nulls last
    if (bv == null) return -1;
    return bv - av;
  });

  return (
    <main className="flex flex-1 flex-col items-center px-6">
      <div className="w-full max-w-[720px] flex flex-col gap-10 py-10">
        {/* Header */}
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] text-text-muted uppercase tracking-wider font-medium">
              Dashboard
            </span>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-display text-3xl font-bold leading-none tracking-tight">
                Hello,
              </span>
              <DisplayNameEditor
                initial={profile?.display_name ?? null}
                fallback={user.email?.split("@")[0] ?? user.email ?? "friend"}
              />
            </div>
          </div>
          <form action="/auth/signout" method="POST">
            <Button type="submit" variant="ghost" size="sm" className="font-medium">
              Sign out
            </Button>
          </form>
        </header>

        {/* Everything below shares currency state via CurrencyProvider so
            the hero pill toggle also re-renders asset row values. */}
        <CurrencyProvider
          baseCurrency={baseCurrency}
          currencies={currencies}
          fxRates={fxRates}
        >
          <NetWorthHero
            rows={rowsWithValue.map((r) => ({
              native_currency: r.native_currency,
              value_native: r.value_native,
            }))}
          />

        {/* Assets list */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] text-text-muted uppercase tracking-wider font-medium">
              Assets
            </h2>
            <AddAssetDrawer baseCurrency={baseCurrency} />
          </div>

          {rowsWithValue.length === 0 ? (
            <div className="p-8 rounded-lg bg-surface border border-border text-center">
              <div className="text-sm text-text-secondary mb-1">
                No assets yet.
              </div>
              <div className="text-xs text-text-muted">
                Tap <span className="text-foreground font-medium">+ Add asset</span>{" "}
                to log a stock, crypto, or cash holding.
              </div>
            </div>
          ) : (
            <AssetsList rows={rowsWithValue} />
          )}
        </section>
        </CurrencyProvider>
      </div>
    </main>
  );
}
