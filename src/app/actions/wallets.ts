"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPrice } from "@/lib/prices";
import { resolveAddressOrEns, lookupEnsName } from "@/lib/ethereum";
import {
  getNativeBalance,
  getErc20Balances,
  formatUnits,
  SUPPORTED_CHAINS,
  NATIVE_COIN,
  CHAIN_LABEL,
  type Chain,
  type TokenBalance,
} from "@/lib/alchemy";
import { resolveTokenSlugs, type TokenSlugRow } from "@/lib/eth-tokens";

const DUST_USD = 1;

const SCAM_PATTERNS = [
  /https?:\/\//i,
  /\.(com|io|xyz|org|net|finance)\b/i,
  /\bclaim\b/i,
  /\bvisit\b/i,
  /\breward\b/i,
  /\bairdrop\b/i,
];

type ConnectInput = {
  input: string;
  label?: string | null;
};

export type ConnectWalletResult =
  | { ok: true; walletId: string; tokensAdded: number; totalUsd: number }
  | { ok: false; error: string };

export type WalletMutateResult = { ok: true } | { ok: false; error: string };

export async function connectWallet(
  opts: ConnectInput,
): Promise<ConnectWalletResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const resolved = await resolveAddressOrEns(opts.input);
  if (!resolved) {
    return {
      ok: false,
      error:
        "That doesn't look like a valid Ethereum address or ENS name. Try a 0x… address or name.eth.",
    };
  }

  let ensName = resolved.ensName;
  if (!ensName) ensName = await lookupEnsName(resolved.address);

  const { data: wallet, error: upsertErr } = await supabase
    .from("connected_wallets")
    .upsert(
      {
        user_id: user.id,
        address: resolved.address,
        ens_name: ensName,
        label: opts.label?.trim() || null,
        connection_method: "address",
      },
      { onConflict: "user_id,address" },
    )
    .select("id")
    .single();

  if (upsertErr || !wallet) {
    return { ok: false, error: upsertErr?.message ?? "Failed to save wallet" };
  }

  const syncResult = await runSync(wallet.id, user.id, resolved.address);
  if (!syncResult.ok) return { ok: false, error: syncResult.error };

  revalidatePath("/dashboard");
  return {
    ok: true,
    walletId: wallet.id,
    tokensAdded: syncResult.tokensAdded,
    totalUsd: syncResult.totalUsd,
  };
}

export async function resyncWallet(
  walletId: string,
): Promise<ConnectWalletResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: wallet } = await supabase
    .from("connected_wallets")
    .select("id, address")
    .eq("id", walletId)
    .single();
  if (!wallet) return { ok: false, error: "Wallet not found" };

  const result = await runSync(wallet.id, user.id, wallet.address);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/dashboard");
  return {
    ok: true,
    walletId: wallet.id,
    tokensAdded: result.tokensAdded,
    totalUsd: result.totalUsd,
  };
}

export async function renameWallet(
  walletId: string,
  label: string,
): Promise<WalletMutateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await supabase
    .from("connected_wallets")
    .update({ label: label.trim() || null })
    .eq("id", walletId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function disconnectWallet(
  walletId: string,
  opts: { keepAssets: boolean },
): Promise<WalletMutateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  if (!opts.keepAssets) {
    const { error: assetsErr } = await supabase
      .from("assets")
      .delete()
      .eq("wallet_id", walletId);
    if (assetsErr) return { ok: false, error: assetsErr.message };
  }

  const { error } = await supabase
    .from("connected_wallets")
    .delete()
    .eq("id", walletId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Core sync — iterates all supported chains, aggregates balances by CoinGecko
// slug (so USDT-on-ETH + USDT-on-BSC merge into one "USDT" asset with summed
// quantity), then upserts.
// -----------------------------------------------------------------------------
type SyncOk = { ok: true; tokensAdded: number; totalUsd: number };
type SyncErr = { ok: false; error: string };

type SlugAgg = {
  slug: string;
  symbol: string;
  name: string;
  logo: string | null;
  quantity: number;
  /** Breakdown per chain for metadata + future per-chain UI. */
  chains: Partial<Record<Chain, { quantity: number; contract: string | null }>>;
};

async function runSync(
  walletId: string,
  userId: string,
  address: string,
): Promise<SyncOk | SyncErr> {
  // Fetch all chains in parallel. One chain failing shouldn't tank the others.
  const chainResults = await Promise.allSettled(
    SUPPORTED_CHAINS.map(async (chain) => {
      const [nativeWei, erc20s] = await Promise.all([
        getNativeBalance(chain, address),
        getErc20Balances(chain, address),
      ]);
      return { chain, nativeWei, erc20s };
    }),
  );

  // Collect RPC errors to surface if *every* chain failed (usually means
  // ALCHEMY_API_KEY missing or rate-limited). Single-chain errors are silent.
  const rpcErrors: string[] = [];
  for (const r of chainResults) {
    if (r.status === "rejected") {
      rpcErrors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
    }
  }
  if (rpcErrors.length === chainResults.length) {
    return {
      ok: false,
      error: `Couldn't read from any chain: ${rpcErrors[0] ?? "unknown error"}`,
    };
  }

  // Aggregate candidates across chains, keyed by CoinGecko slug.
  const bySlug = new Map<string, SlugAgg>();

  function addCandidate(
    chain: Chain,
    slug: string,
    symbol: string,
    name: string,
    logo: string | null,
    contract: string | null,
    quantity: number,
  ) {
    if (!(quantity > 0)) return;
    if (isScammy(name) || isScammy(symbol)) return;
    const existing = bySlug.get(slug);
    if (existing) {
      existing.quantity += quantity;
      const prev = existing.chains[chain];
      existing.chains[chain] = {
        quantity: (prev?.quantity ?? 0) + quantity,
        contract,
      };
      // Prefer a non-null logo/name across chains.
      if (!existing.logo && logo) existing.logo = logo;
    } else {
      bySlug.set(slug, {
        slug,
        symbol,
        name,
        logo,
        quantity,
        chains: { [chain]: { quantity, contract } },
      });
    }
  }

  for (const r of chainResults) {
    if (r.status !== "fulfilled") continue;
    const { chain, nativeWei, erc20s } = r.value;

    // Native coin
    const native = NATIVE_COIN[chain];
    const nativeQty = formatUnits(nativeWei, native.decimals);
    if (nativeQty > 0) {
      addCandidate(
        chain,
        native.slug,
        native.symbol,
        native.name,
        null,
        null,
        nativeQty,
      );
    }

    // ERC-20s on this chain — resolve contract → slug in a batch.
    const slugMap: Map<string, TokenSlugRow> = await resolveTokenSlugs(
      chain,
      erc20s.map((t) => t.contractAddress),
    );
    for (const tb of erc20s) {
      const meta = slugMap.get(tb.contractAddress);
      if (!meta?.coingecko_slug) continue;
      if (meta.decimals == null) continue;
      const name = meta.name ?? meta.symbol ?? "Unknown token";
      const symbol = (meta.symbol ?? "").toUpperCase();
      const qty = formatUnits(tb.balance, meta.decimals);
      addCandidate(
        chain,
        meta.coingecko_slug,
        symbol || meta.coingecko_slug.toUpperCase(),
        name,
        meta.logo,
        tb.contractAddress,
        qty,
      );
    }
  }

  // Price everything in USD once per slug.
  const uniqueSlugs = Array.from(bySlug.keys());
  const priceResults = await Promise.allSettled(
    uniqueSlugs.map(async (slug) => {
      const quote = await fetchPrice("coingecko", slug, "USD");
      return { slug, quote };
    }),
  );
  const priceBySlug = new Map<
    string,
    { price: number; previousClose: number | null; asOf: string }
  >();
  for (const r of priceResults) {
    if (r.status !== "fulfilled" || !r.value.quote) continue;
    priceBySlug.set(r.value.slug, {
      price: r.value.quote.price,
      previousClose: r.value.quote.previousClose,
      asOf: r.value.quote.asOf,
    });
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  let tokensAdded = 0;
  let totalUsd = 0;
  const priceRowsToCache: {
    external_id: string;
    source: "coingecko";
    price_native: number;
    previous_native: number | null;
    currency: string;
    fetched_at: string;
  }[] = [];

  const { data: existing } = await supabase
    .from("assets")
    .select("id, external_id")
    .eq("user_id", userId)
    .eq("wallet_id", walletId);
  const existingBySlug = new Map<string, string>();
  for (const row of existing ?? []) {
    if (row.external_id) existingBySlug.set(row.external_id, row.id);
  }

  for (const agg of bySlug.values()) {
    const price = priceBySlug.get(agg.slug);
    if (!price) continue;
    const valueUsd = agg.quantity * price.price;
    if (valueUsd < DUST_USD) continue;

    totalUsd += valueUsd;
    priceRowsToCache.push({
      external_id: agg.slug,
      source: "coingecko",
      price_native: price.price,
      previous_native: price.previousClose,
      currency: "USD",
      fetched_at: price.asOf,
    });

    const chainList = Object.keys(agg.chains) as Chain[];
    const chainLabels = chainList.map((c) => CHAIN_LABEL[c]).join(", ");
    const displayName =
      chainList.length === 1 ? agg.name : `${agg.symbol} (${chainLabels})`;

    const existingId = existingBySlug.get(agg.slug);
    if (existingId) {
      // Keep metadata in sync (new chains might have been added since the
      // last sync) + append a fresh snapshot for the merged total.
      await supabase
        .from("assets")
        .update({
          name: displayName,
          metadata: {
            logo: agg.logo,
            chains: agg.chains,
          },
        })
        .eq("id", existingId);

      const { error } = await supabase.from("balance_snapshots").insert({
        asset_id: existingId,
        quantity: agg.quantity,
        source: "imported",
      });
      if (error) continue;
      tokensAdded += 1;
      continue;
    }

    const { data: asset, error: assetErr } = await supabase
      .from("assets")
      .insert({
        user_id: userId,
        wallet_id: walletId,
        name: displayName,
        symbol: agg.symbol || null,
        asset_class: "crypto",
        native_currency: "USD",
        price_source: "coingecko",
        external_id: agg.slug,
        metadata: { logo: agg.logo, chains: agg.chains },
      })
      .select("id")
      .single();
    if (assetErr || !asset) continue;

    const { error: snapErr } = await supabase.from("balance_snapshots").insert({
      asset_id: asset.id,
      quantity: agg.quantity,
      source: "imported",
    });
    if (snapErr) continue;

    tokensAdded += 1;
  }

  await supabase
    .from("connected_wallets")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", walletId);

  if (priceRowsToCache.length) {
    after(async () => {
      const { error } = await admin
        .from("price_cache")
        .upsert(priceRowsToCache, { onConflict: "external_id,source" });
      if (error) console.error("price_cache upsert (wallet sync):", error.message);
    });
  }

  return { ok: true, tokensAdded, totalUsd };
}

function isScammy(s: string): boolean {
  return SCAM_PATTERNS.some((r) => r.test(s));
}
