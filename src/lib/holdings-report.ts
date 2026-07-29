import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchFxRates, convertFx } from "@/lib/fx";
import { fetchPrice } from "@/lib/prices";
import {
  analyzeConcentration,
  type Holding,
  type ConcentrationReport,
} from "@/lib/insights";
import type { AssetListRow } from "@/components/assets-list";

// Shared holdings/insight fetch used by both /dashboard (Overview) and
// /insights. Extracted so the two surfaces stay in lock-step rather than
// duplicating (and slowly drifting) the same ~200 lines of setup.
//
// Not included: history backfill triggers, logo refresh, connected wallets —
// those are dashboard-specific concerns kept at the route level.

const PRICE_TTL_MS = 10 * 60 * 1000;

export type HoldingsRow = AssetListRow & {
  previous_value_native: number | null;
};

export type FxRates = Awaited<ReturnType<typeof fetchFxRates>>;

export type HoldingsReport = {
  baseCurrency: string;
  currencies: string[];
  fxRates: FxRates;
  rowsWithValue: HoldingsRow[];
  holdings: Holding[];
  concentration: ConcentrationReport;
};

/**
 * Returns `null` when no user is signed in — callers should redirect to /login.
 */
export async function getHoldingsReport(): Promise<HoldingsReport | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("base_currency")
    .eq("id", user.id)
    .single();
  const baseCurrency = profile?.base_currency ?? "USD";

  const { data: assets } = await supabase
    .from("assets")
    .select(
      "id, name, symbol, asset_class, native_currency, price_source, external_id, metadata, wallet_id",
    )
    .order("created_at", { ascending: false });

  const assetIds = (assets ?? []).map((a) => a.id);

  const { data: snapshots } = assetIds.length
    ? await supabase
        .from("balance_snapshots")
        .select("asset_id, quantity, snapshot_at")
        .in("asset_id", assetIds)
        .order("snapshot_at", { ascending: false })
    : {
        data: [] as {
          asset_id: string;
          quantity: number;
          snapshot_at: string;
        }[],
      };

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
      if (p.fetched_at) {
        fetchedAtByKey.set(key, new Date(p.fetched_at).getTime());
      }
    }
  }

  // Refresh if stale, or if previous_native is missing (backfill path for
  // rows cached before the TODAY-delta feature shipped).
  const now = Date.now();
  const toRefresh = (assets ?? []).filter((a) => {
    if (!a.external_id || a.price_source === "manual") return false;
    const key = `${a.external_id}|${a.price_source}`;
    const fetchedAt = fetchedAtByKey.get(key);
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

  const rows: HoldingsRow[] = (assets ?? []).map((a) => {
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

  const baseValue = (r: HoldingsRow): number | null => {
    if (r.value_native == null) return null;
    if (r.native_currency === baseCurrency) return r.value_native;
    if (!fxRates) return null;
    return convertFx(r.value_native, r.native_currency, baseCurrency, fxRates);
  };

  const rowsWithValue = [...rows].sort((a, b) => {
    const av = baseValue(a);
    const bv = baseValue(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return bv - av;
  });

  const holdings: Holding[] = rowsWithValue
    .map((r) => {
      const v = baseValue(r);
      return v == null
        ? null
        : {
            name: r.name,
            symbol: r.symbol,
            assetClass: r.asset_class as Holding["assetClass"],
            valueBase: v,
          };
    })
    .filter((h): h is Holding => h !== null);

  const concentration = analyzeConcentration(holdings);

  return {
    baseCurrency,
    currencies,
    fxRates,
    rowsWithValue,
    holdings,
    concentration,
  };
}
