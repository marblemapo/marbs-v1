import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { AddAssetDrawer } from "@/components/add-asset-drawer";
import { DisplayNameEditor } from "@/components/display-name-editor";
import { AssetsList, type AssetListRow } from "@/components/assets-list";
import {
  ConnectedWalletsSection,
  type ConnectedWalletRow,
} from "@/components/connected-wallets-section";
import { NetWorthHero } from "@/components/networth-hero";
import { CurrencyProvider } from "@/components/currency-context";
import { fetchFxRates, convertFx } from "@/lib/fx";
import { fetchPrice } from "@/lib/prices";

const PRICE_TTL_MS = 10 * 60 * 1000;

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, base_currency, created_at")
    .eq("id", user.id)
    .single();

  const baseCurrency = profile?.base_currency ?? "USD";

  const { data: assets } = await supabase
    .from("assets")
    .select(
      "id, name, symbol, asset_class, native_currency, price_source, external_id, metadata, wallet_id",
    )
    .order("created_at", { ascending: false });

  const { data: connectedWalletsRaw } = await supabase
    .from("connected_wallets")
    .select("id, address, ens_name, label, last_synced_at")
    .order("created_at", { ascending: true });

  const assetIds = (assets ?? []).map((a) => a.id);

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

  const priceKeys = (assets ?? [])
    .filter((a) => a.external_id && a.price_source !== "manual")
    .map((a) => ({ external_id: a.external_id!, source: a.price_source }));

  const priceByKey = new Map<string, number>();
  const previousByKey = new Map<string, number>();
  const fetchedAtByKey = new Map<string, number>();
  if (priceKeys.length) {
    const { data: prices } = await supabase
      .from("price_cache")
      .select("external_id, source, price_native, previous_native, fetched_at")
      .in(
        "external_id",
        priceKeys.map((k) => k.external_id),
      );
    for (const p of prices ?? []) {
      const key = `${p.external_id}|${p.source}`;
      priceByKey.set(key, Number(p.price_native));
      if (p.previous_native != null) {
        previousByKey.set(key, Number(p.previous_native));
      }
      if (p.fetched_at) fetchedAtByKey.set(key, new Date(p.fetched_at).getTime());
    }
  }

  const now = Date.now();
  const toRefresh = (assets ?? []).filter((a) => {
    if (!a.external_id || a.price_source === "manual") return false;
    const key = `${a.external_id}|${a.price_source}`;
    const fetchedAt = fetchedAtByKey.get(key);
    // Refresh if stale OR if previous_native is missing (backfill path for
    // rows cached before the TODAY-delta feature shipped).
    return (
      fetchedAt == null ||
      now - fetchedAt > PRICE_TTL_MS ||
      !previousByKey.has(key)
    );
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
      if (quote.previousClose != null) {
        previousByKey.set(key, quote.previousClose);
      }
    }
    if (upserts.length) {
      await admin.from("price_cache").upsert(
        upserts.map(({ asset, quote }) => ({
          external_id: asset.external_id!,
          source: asset.price_source,
          price_native: quote.price,
          previous_native: quote.previousClose,
          currency: quote.currency,
          fetched_at: quote.asOf,
        })),
        { onConflict: "external_id,source" },
      );
    }
  }

  const rows: (AssetListRow & { previous_value_native: number | null })[] = (
    assets ?? []
  ).map((a) => {
    const latest_quantity = latestByAsset.get(a.id) ?? null;
    const key = a.external_id ? `${a.external_id}|${a.price_source}` : null;
    const latest_price = a.external_id
      ? priceByKey.get(key!) ?? null
      : a.price_source === "manual"
        ? 1
        : null;
    const previous_price = a.external_id
      ? previousByKey.get(key!) ?? null
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
      wallet_id: a.wallet_id ?? null,
      latest_quantity,
      latest_price,
      logo,
      value_native:
        latest_quantity != null && latest_price != null
          ? latest_quantity * latest_price
          : null,
      previous_value_native:
        latest_quantity != null && previous_price != null
          ? latest_quantity * previous_price
          : null,
    };
  });

  const currencySet = new Set<string>([baseCurrency]);
  for (const r of rows) currencySet.add(r.native_currency);
  const currencies = Array.from(currencySet);
  const fxRates = await fetchFxRates(baseCurrency, currencies);

  const baseValue = (r: (typeof rows)[number]): number | null => {
    if (r.value_native == null) return null;
    if (r.native_currency === baseCurrency) return r.value_native;
    if (!fxRates) return null;
    return convertFx(r.value_native, r.native_currency, baseCurrency, fxRates);
  };
  // Aggregate assets per connected wallet for the wallets section above.
  const walletAgg = new Map<string, { count: number; totalBase: number }>();
  for (const r of rows) {
    if (!r.wallet_id) continue;
    const agg = walletAgg.get(r.wallet_id) ?? { count: 0, totalBase: 0 };
    agg.count += 1;
    if (r.value_native != null) {
      const inBase =
        r.native_currency === baseCurrency
          ? r.value_native
          : fxRates
            ? convertFx(r.value_native, r.native_currency, baseCurrency, fxRates)
            : null;
      if (inBase != null) agg.totalBase += inBase;
    }
    walletAgg.set(r.wallet_id, agg);
  }

  const connectedWallets: ConnectedWalletRow[] = (connectedWalletsRaw ?? []).map(
    (w) => ({
      id: w.id,
      address: w.address,
      ens_name: w.ens_name,
      label: w.label,
      last_synced_at: w.last_synced_at,
      token_count: walletAgg.get(w.id)?.count ?? 0,
      total_usd_in_base: walletAgg.get(w.id)?.totalBase ?? 0,
    }),
  );

  const rowsWithValue = [...rows].sort((a, b) => {
    const av = baseValue(a);
    const bv = baseValue(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return bv - av;
  });

  return (
    <main className="f3-stage flex-1">
      <div className="mx-auto w-full max-w-[780px] px-6 pt-14 pb-24 flex flex-col gap-10 f3-fade-in">
        {/* Top bar — matches landing/login */}
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill bg-white/[0.04] border border-white/[0.08] font-plex text-[12px] font-medium text-[#EBEBF5] tracking-wide">
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#7FFFD4] f3-pulse"
              style={{ boxShadow: "0 0 10px #7FFFD4" }}
            />
            Wealth · v1
          </div>
          <form action="/auth/signout" method="POST">
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="font-plex text-[12px] font-medium text-text-muted hover:text-foreground hover:bg-transparent"
            >
              Sign out
            </Button>
          </form>
        </div>

        {/* Greeting header */}
        <header className="flex flex-col gap-2">
          <span className="font-plex text-[11px] text-text-muted uppercase tracking-[0.14em] font-medium">
            Dashboard
          </span>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-sans text-4xl font-bold leading-none tracking-[-0.025em]">
              Hello,
            </span>
            <DisplayNameEditor
              initial={profile?.display_name ?? null}
              fallback={user.email?.split("@")[0] ?? user.email ?? "friend"}
            />
          </div>
        </header>

        <CurrencyProvider
          baseCurrency={baseCurrency}
          currencies={currencies}
          fxRates={fxRates}
        >
          <NetWorthHero
            rows={rowsWithValue.map((r) => ({
              native_currency: r.native_currency,
              value_native: r.value_native,
              previous_value_native: r.previous_value_native,
            }))}
          />

          <ConnectedWalletsSection
            wallets={connectedWallets}
            baseCurrency={baseCurrency}
          />

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-plex text-[11px] text-text-muted uppercase tracking-[0.14em] font-medium">
                Assets
              </h2>
              <AddAssetDrawer baseCurrency={baseCurrency} />
            </div>

            {rowsWithValue.length === 0 ? (
              <div className="f3-card p-8 flex flex-col items-center gap-4 text-center">
                <div className="flex flex-col gap-1">
                  <div className="font-sans text-lg font-bold">
                    No holdings yet
                  </div>
                  <div className="text-sm text-text-secondary max-w-[380px]">
                    Add everything in one pass — stocks, crypto, cash — and see
                    your net worth in about three minutes.
                  </div>
                </div>
                <a href="/onboarding" className="f3-cta">
                  Log my holdings →
                </a>
                <div className="font-plex text-xs text-text-muted">
                  Prefer one at a time? Use the{" "}
                  <span className="text-[#7FFFD4] font-medium">+ Add asset</span>{" "}
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
