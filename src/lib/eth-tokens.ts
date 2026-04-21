/**
 * ERC-20 contract address → CoinGecko slug resolver.
 *
 * The rest of the app already knows how to fetch a price for any
 * (price_source='coingecko', external_id=<slug>) pair — see
 * src/lib/prices.ts#fetchCoinGeckoQuote. All this module needs to do is map
 * contract addresses to slugs so the normal price path takes over.
 *
 * Uses the shared `token_slug_cache` table. Null slug = negative cache (7-day
 * TTL) — CoinGecko doesn't know this contract, don't keep asking.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type TokenSlugRow = {
  contract_address: string;
  coingecko_slug: string | null;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  logo: string | null;
};

const NEGATIVE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const POSITIVE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type CacheRow = TokenSlugRow & { fetched_at: string };

function isStale(row: CacheRow): boolean {
  const age = Date.now() - new Date(row.fetched_at).getTime();
  return row.coingecko_slug ? age > POSITIVE_TTL_MS : age > NEGATIVE_TTL_MS;
}

/**
 * Look up multiple contracts in one DB round-trip, then fetch misses from
 * CoinGecko one-by-one (free tier is 10-30 req/min — keep concurrency low).
 */
export async function resolveTokenSlugs(
  contracts: string[],
): Promise<Map<string, TokenSlugRow>> {
  const normalized = Array.from(
    new Set(contracts.map((c) => c.toLowerCase())),
  );
  const out = new Map<string, TokenSlugRow>();
  if (normalized.length === 0) return out;

  const admin = createAdminClient();
  const { data: cached } = await admin
    .from("token_slug_cache")
    .select("contract_address, coingecko_slug, symbol, name, decimals, logo, fetched_at")
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

  // Fetch misses serially to stay under CoinGecko's free-tier rate limit.
  for (const contract of misses) {
    const row = await fetchAndCacheFromCoinGecko(contract);
    out.set(contract, row);
  }

  return out;
}

async function fetchAndCacheFromCoinGecko(
  contract: string,
): Promise<TokenSlugRow> {
  const admin = createAdminClient();
  const url = `https://api.coingecko.com/api/v3/coins/ethereum/contract/${contract}`;

  let row: TokenSlugRow = {
    contract_address: contract,
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
          coingecko_slug: slug,
          symbol: typeof data?.symbol === "string" ? data.symbol.toUpperCase() : null,
          name: typeof data?.name === "string" ? data.name : null,
          // CoinGecko exposes `detail_platforms.ethereum.decimal_place`
          decimals:
            typeof data?.detail_platforms?.ethereum?.decimal_place === "number"
              ? data.detail_platforms.ethereum.decimal_place
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
    // 404 → negative cache (row stays with slug=null).
  } catch {
    // Network hiccup — still write a negative cache; next request will retry
    // after TTL expires.
  }

  const { error } = await admin.from("token_slug_cache").upsert(
    {
      contract_address: row.contract_address,
      chain: "ethereum",
      coingecko_slug: row.coingecko_slug,
      symbol: row.symbol,
      name: row.name,
      decimals: row.decimals,
      logo: row.logo,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "contract_address" },
  );
  if (error) console.error("token_slug_cache upsert:", error.message);

  return row;
}
