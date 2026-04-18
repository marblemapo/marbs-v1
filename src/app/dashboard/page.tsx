import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { AddAssetDrawer } from "@/components/add-asset-drawer";
import { DisplayNameEditor } from "@/components/display-name-editor";
import { AssetsList, type AssetListRow } from "@/components/assets-list";
import { NetWorthHero } from "@/components/networth-hero";
import { CurrencyProvider } from "@/components/currency-context";
import { fetchFxRates, convertFx } from "@/lib/fx";
import { fetchPrice } from "@/lib/prices";
import { cn } from "@/lib/utils";

// Re-fetch any price_cache row older than this on dashboard load.
const PRICE_TTL_MS = 10 * 60 * 1000; // 10 minutes

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
  const fetchedAtByKey = new Map<string, number>();
  if (priceKeys.length) {
    const { data: prices } = await supabase
      .from("price_cache")
      .select("external_id, source, price_native, fetched_at")
      .in(
        "external_id",
        priceKeys.map((k) => k.external_id),
      );
    for (const p of prices ?? []) {
      const key = `${p.external_id}|${p.source}`;
      priceByKey.set(key, Number(p.price_native));
      if (p.fetched_at) fetchedAtByKey.set(key, new Date(p.fetched_at).getTime());
    }
  }

  // Refresh any price whose cache is missing or older than PRICE_TTL_MS.
  // Done in parallel; failures fall back to the stale cached value.
  const now = Date.now();
  const toRefresh = (assets ?? []).filter((a) => {
    if (!a.external_id || a.price_source === "manual") return false;
    const key = `${a.external_id}|${a.price_source}`;
    const fetchedAt = fetchedAtByKey.get(key);
    return fetchedAt == null || now - fetchedAt > PRICE_TTL_MS;
  });

  if (toRefresh.length) {
    const fresh = await Promise.all(
      toRefresh.map(async (a) => {
        const quote = await fetchPrice(
          a.price_source,
          a.external_id,
          a.native_currency,
        );
        return quote ? { asset: a, quote } : null;
      }),
    );

    const admin = createAdminClient();
    const upserts = fresh.filter((r): r is NonNullable<typeof r> => r != null);
    for (const { asset, quote } of upserts) {
      const key = `${asset.external_id}|${asset.price_source}`;
      priceByKey.set(key, quote.price);
    }
    if (upserts.length) {
      await admin.from("price_cache").upsert(
        upserts.map(({ asset, quote }) => ({
          external_id: asset.external_id!,
          source: asset.price_source,
          price_native: quote.price,
          currency: quote.currency,
          fetched_at: quote.asOf,
        })),
        { onConflict: "external_id,source" },
      );
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
            <div className="p-8 rounded-lg bg-surface border border-border flex flex-col items-center gap-4 text-center">
              <div className="flex flex-col gap-1">
                <div className="font-display text-lg font-bold">
                  No holdings yet
                </div>
                <div className="text-sm text-text-secondary max-w-[380px]">
                  Add everything in one pass — stocks, crypto, cash — and see
                  your net worth in about three minutes.
                </div>
              </div>
              <a
                href="/onboarding"
                className={cn(
                  "inline-flex items-center gap-2 h-11 px-5 rounded-lg font-semibold text-sm transition-colors",
                  "bg-primary text-primary-foreground hover:bg-primary/80",
                )}
              >
                Log my holdings →
              </a>
              <div className="text-xs text-text-muted">
                Prefer one at a time? Use the{" "}
                <span className="text-foreground font-medium">+ Add asset</span>{" "}
                button above.
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
