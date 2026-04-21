"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPrice } from "@/lib/prices";
import {
  resolveAddressOrEns,
  lookupEnsName,
  buildSiweMessage,
  verifySiweSignature,
  generateNonce,
} from "@/lib/ethereum";
import {
  getEthBalance,
  getErc20Balances,
  formatUnits,
  type TokenBalance,
} from "@/lib/alchemy";
import { resolveTokenSlugs } from "@/lib/eth-tokens";

const DUST_USD = 1;
const SIWE_MAX_AGE_MS = 5 * 60 * 1000;

// Obvious scam patterns in token names — airdrop farms use URLs, "claim", etc.
// Err toward dropping: user can always add a legit token manually.
const SCAM_PATTERNS = [
  /https?:\/\//i,
  /\.(com|io|xyz|org|net|finance)\b/i,
  /\bclaim\b/i,
  /\bvisit\b/i,
  /\breward\b/i,
  /\bairdrop\b/i,
];

type ConnectInput = {
  input: string;               // raw text: 0x... or ENS name
  label?: string | null;
  method: "address" | "signature";
  message?: string;            // required if method='signature'
  signature?: `0x${string}`;   // required if method='signature'
};

export type ConnectWalletResult =
  | { ok: true; walletId: string; tokensAdded: number; totalUsd: number }
  | { ok: false; error: string };

export type WalletMutateResult = { ok: true } | { ok: false; error: string };

// -----------------------------------------------------------------------------
// SIWE challenge — the server generates the message the client will ask the
// wallet to sign. Embedding a server-generated nonce + issuedAt lets us bound
// signature freshness on return.
//
// v1 tradeoff: we don't persist nonces server-side. Replay is bounded by the
// 5-minute `issuedAt` window + the unique(user, chain, address) index, which
// makes "register the same wallet twice" a no-op. Low stakes (read-only).
// -----------------------------------------------------------------------------
export type SiweChallenge = {
  message: string;
  nonce: string;
  issuedAt: string;
};

export async function createSiweChallenge(params: {
  address: string;
  domain: string;
  uri: string;
}): Promise<SiweChallenge | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  if (!/^0x[a-fA-F0-9]{40}$/.test(params.address)) {
    return { error: "Invalid address" };
  }

  const nonce = generateNonce();
  const issuedAt = new Date().toISOString();
  const message = buildSiweMessage({
    domain: params.domain,
    address: params.address,
    uri: params.uri,
    version: "1",
    chainId: 1,
    nonce,
    issuedAt,
    statement:
      "Prove you own this wallet so marbs can read its on-chain balances. " +
      "This signature grants no spend or approval rights.",
  });
  return { message, nonce, issuedAt };
}

// -----------------------------------------------------------------------------
// Connect: resolve address → (optional) verify signature → insert wallet →
// immediately run first sync.
// -----------------------------------------------------------------------------
export async function connectWallet(
  opts: ConnectInput,
): Promise<ConnectWalletResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const resolved = await resolveAddressOrEns(opts.input);
  if (!resolved) {
    return {
      ok: false,
      error:
        "That doesn't look like a valid Ethereum address or ENS name. Try a 0x… address or name.eth.",
    };
  }

  // SIWE verification for "connect wallet" flow.
  if (opts.method === "signature") {
    if (!opts.message || !opts.signature) {
      return { ok: false, error: "Missing signature or message." };
    }
    const ok = await verifySiweSignature({
      message: opts.message,
      signature: opts.signature,
      expectedAddress: resolved.address,
    });
    if (!ok) return { ok: false, error: "Signature verification failed." };

    const issuedMatch = opts.message.match(/^Issued At: (.+)$/m);
    const issuedAt = issuedMatch ? Date.parse(issuedMatch[1]) : NaN;
    if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > SIWE_MAX_AGE_MS) {
      return { ok: false, error: "Signature expired. Try again." };
    }
  }

  // If we only got a hex address, try a reverse ENS lookup so the UI can show
  // a friendly name. Non-fatal on failure.
  let ensName = resolved.ensName;
  if (!ensName) ensName = await lookupEnsName(resolved.address);

  // Upsert the wallet row (unique index on user_id + chain + address lets us
  // return the existing id on reconnect instead of erroring).
  const { data: wallet, error: upsertErr } = await supabase
    .from("connected_wallets")
    .upsert(
      {
        user_id: user.id,
        chain: "ethereum",
        address: resolved.address,
        ens_name: ensName,
        label: opts.label?.trim() || null,
        connection_method: opts.method,
      },
      { onConflict: "user_id,chain,address" },
    )
    .select("id")
    .single();

  if (upsertErr || !wallet) {
    return {
      ok: false,
      error: upsertErr?.message ?? "Failed to save wallet",
    };
  }

  const syncResult = await runSync(wallet.id, user.id, resolved.address);
  if (!syncResult.ok) {
    // Keep the wallet row — user can retry resync — but surface the error.
    return { ok: false, error: syncResult.error };
  }

  revalidatePath("/dashboard");
  return {
    ok: true,
    walletId: wallet.id,
    tokensAdded: syncResult.tokensAdded,
    totalUsd: syncResult.totalUsd,
  };
}

// -----------------------------------------------------------------------------
// Resync — pulls the latest balances for an already-connected wallet.
// -----------------------------------------------------------------------------
export async function resyncWallet(
  walletId: string,
): Promise<ConnectWalletResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

// -----------------------------------------------------------------------------
// Rename + disconnect
// -----------------------------------------------------------------------------
export async function renameWallet(
  walletId: string,
  label: string,
): Promise<WalletMutateResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  if (!opts.keepAssets) {
    // Cascades to balance_snapshots via FK ON DELETE CASCADE on assets.
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
// Core sync — shared by connectWallet + resyncWallet.
//
// Per-token errors are isolated with Promise.allSettled so one bad token
// never aborts the batch. Pricing failures drop the token from the import
// rather than inserting a valueless row.
// -----------------------------------------------------------------------------
type SyncOk = { ok: true; tokensAdded: number; totalUsd: number };
type SyncErr = { ok: false; error: string };

async function runSync(
  walletId: string,
  userId: string,
  address: string,
): Promise<SyncOk | SyncErr> {
  let ethWei: bigint;
  let erc20s: TokenBalance[];
  try {
    [ethWei, erc20s] = await Promise.all([
      getEthBalance(address),
      getErc20Balances(address),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "on-chain read failed";
    return { ok: false, error: `Couldn't read from Ethereum: ${msg}` };
  }

  const slugMap = await resolveTokenSlugs(erc20s.map((t) => t.contractAddress));

  // Build a list of (slug, quantity, contract, meta) tuples to price + insert.
  type Candidate = {
    slug: string;
    symbol: string;
    name: string;
    logo: string | null;
    contract: string | null;
    quantity: number;
  };
  const candidates: Candidate[] = [];

  // ETH itself always priceable via coingecko slug "ethereum".
  const ethQty = formatUnits(ethWei, 18);
  if (ethQty > 0) {
    candidates.push({
      slug: "ethereum",
      symbol: "ETH",
      name: "Ethereum",
      logo: null,
      contract: null,
      quantity: ethQty,
    });
  }

  for (const tb of erc20s) {
    const meta = slugMap.get(tb.contractAddress);
    if (!meta?.coingecko_slug) continue; // no price source → skip
    if (meta.decimals == null) continue;

    const name = meta.name ?? meta.symbol ?? "Unknown token";
    const symbol = (meta.symbol ?? "").toUpperCase();
    if (isScammy(name) || isScammy(symbol)) continue;

    const qty = formatUnits(tb.balance, meta.decimals);
    if (!(qty > 0)) continue;

    candidates.push({
      slug: meta.coingecko_slug,
      symbol: symbol || meta.coingecko_slug.toUpperCase(),
      name,
      logo: meta.logo,
      contract: tb.contractAddress,
      quantity: qty,
    });
  }

  // Price everything in USD. fetchPrice hits CoinGecko which is rate-limited
  // on free tier; dedupe slugs first so we make at most one call per token.
  const uniqueSlugs = Array.from(new Set(candidates.map((c) => c.slug)));
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
  const admin = createAdminClient(); // for price_cache writes (public-read RLS)

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

  // Look up all existing assets for this wallet in one query so we know which
  // ones need an insert vs a snapshot-append.
  const { data: existing } = await supabase
    .from("assets")
    .select("id, external_id")
    .eq("user_id", userId)
    .eq("wallet_id", walletId);
  const existingBySlug = new Map<string, string>();
  for (const row of existing ?? []) {
    if (row.external_id) existingBySlug.set(row.external_id, row.id);
  }

  for (const c of candidates) {
    const price = priceBySlug.get(c.slug);
    if (!price) continue; // no price — skip, don't insert a $0 row
    const valueUsd = c.quantity * price.price;
    if (valueUsd < DUST_USD) continue;

    totalUsd += valueUsd;
    priceRowsToCache.push({
      external_id: c.slug,
      source: "coingecko",
      price_native: price.price,
      previous_native: price.previousClose,
      currency: "USD",
      fetched_at: price.asOf,
    });

    const existingId = existingBySlug.get(c.slug);
    if (existingId) {
      const { error } = await supabase.from("balance_snapshots").insert({
        asset_id: existingId,
        quantity: c.quantity,
        source: "imported",
      });
      if (error) continue;
      tokensAdded += 1; // counts touched tokens, whether newly-added or refreshed
      continue;
    }

    const { data: asset, error: assetErr } = await supabase
      .from("assets")
      .insert({
        user_id: userId,
        wallet_id: walletId,
        name: c.name,
        symbol: c.symbol || null,
        asset_class: "crypto",
        native_currency: "USD",
        price_source: "coingecko",
        external_id: c.slug,
        metadata: {
          logo: c.logo,
          contract_address: c.contract,
        },
      })
      .select("id")
      .single();
    if (assetErr || !asset) continue;

    const { error: snapErr } = await supabase.from("balance_snapshots").insert({
      asset_id: asset.id,
      quantity: c.quantity,
      source: "imported",
    });
    if (snapErr) continue;

    tokensAdded += 1;
  }

  await supabase
    .from("connected_wallets")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", walletId);

  // Move price-cache writes off the critical path, same pattern as
  // src/app/actions/assets.ts:310.
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
