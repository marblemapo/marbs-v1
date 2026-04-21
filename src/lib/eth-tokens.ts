/**
 * ERC-20 contract address → CoinGecko slug resolver, per chain.
 *
 * Same contract address can represent different tokens on different chains,
 * and CoinGecko exposes each chain under its own platform slug. So the cache
 * key is (chain, contract_address), not contract_address alone.
 *
 * Null slug = negative cache — CoinGecko doesn't know this contract on this
 * chain; skip it from sync. 7-day TTL.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Chain } from "@/lib/alchemy";

export type TokenSlugRow = {
  contract_address: string;
  chain: Chain;
  coingecko_slug: string | null;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  logo: string | null;
};

const NEGATIVE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const POSITIVE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** CoinGecko platform slug per chain. /coins/{platform}/contract/{address}. */
const COINGECKO_PLATFORM: Record<Chain, string> = {
  ethereum: "ethereum",
  base: "base",
  arbitrum: "arbitrum-one",
  optimism: "optimistic-ethereum",
  polygon: "polygon-pos",
  bsc: "binance-smart-chain",
};

type CacheRow = TokenSlugRow & { fetched_at: string };

function isStale(row: CacheRow): boolean {
  const age = Date.now() - new Date(row.fetched_at).getTime();
  return row.coingecko_slug ? age > POSITIVE_TTL_MS : age > NEGATIVE_TTL_MS;
}

/**
 * Batch-resolve contracts for a single chain. DB round-trip first, then
 * CoinGecko serially (free tier rate limit is tight).
 */
export async function resolveTokenSlugs(
  chain: Chain,
  contracts: string[],
): Promise<Map<string, TokenSlugRow>> {
  const normalized = Array.from(new Set(contracts.map((c) => c.toLowerCase())));
  const out = new Map<string, TokenSlugRow>();
  if (normalized.length === 0) return out;

  const admin = createAdminClient();
  const { data: cached } = await admin
    .from("token_slug_cache")
    .select(
      "contract_address, chain, coingecko_slug, symbol, name, decimals, logo, fetched_at",
    )
    .eq("chain", chain)
    .in("contract_address", normalized);

  const fresh = new Set<string>();
  for (const row of (cached ?? []) as CacheRow[]) {
    if (!isStale(row)) {
      out.set(row.contract_address, row);
      fresh.add(row.contract_address);
    }
  }

  const misses = normalized.filter((c) => !fresh.has(c));
  if (misses.length === 0) return out;

  for (const contract of misses) {
    const row = await fetchAndCacheFromCoinGecko(chain, contract);
    out.set(contract, row);
  }

  return out;
}

async function fetchAndCacheFromCoinGecko(
  chain: Chain,
  contract: string,
): Promise<TokenSlugRow> {
  const admin = createAdminClient();
  const platform = COINGECKO_PLATFORM[chain];
  const url = `https://api.coingecko.com/api/v3/coins/${platform}/contract/${contract}`;

  let row: TokenSlugRow = {
    contract_address: contract,
    chain,
    coingecko_slug: null,
    symbol: null,
    name: null,
    decimals: null,
    logo: null,
  };

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = await res.json();
      const slug: string | null = typeof data?.id === "string" ? data.id : null;
      if (slug) {
        row = {
          contract_address: contract,
          chain,
          coingecko_slug: slug,
          symbol:
            typeof data?.symbol === "string" ? data.symbol.toUpperCase() : null,
          name: typeof data?.name === "string" ? data.name : null,
          decimals:
            typeof data?.detail_platforms?.[platform]?.decimal_place === "number"
              ? data.detail_platforms[platform].decimal_place
              : null,
          logo:
            typeof data?.image?.small === "string"
              ? data.image.small
              : typeof data?.image?.thumb === "string"
                ? data.image.thumb
                : null,
        };
      }
    }
  } catch {
    // Network hiccup — still negative-cache so we don't hammer CoinGecko.
  }

  const { error } = await admin.from("token_slug_cache").upsert(
    {
      contract_address: row.contract_address,
      chain: row.chain,
      coingecko_slug: row.coingecko_slug,
      symbol: row.symbol,
      name: row.name,
      decimals: row.decimals,
      logo: row.logo,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "chain,contract_address" },
  );
  if (error) console.error("token_slug_cache upsert:", error.message);

  return row;
}
