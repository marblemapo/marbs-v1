/**
 * CoinGecko requires slug IDs (e.g. "bitcoin"), not tickers ("BTC").
 * We hardcode the top ~40 by market cap, then fall back to CoinGecko's
 * /search endpoint for anything else (cached 1h).
 *
 * Keep this list short — it's only for the 99% common cases. For obscure
 * coins users can paste the slug into the drawer's Advanced field.
 */

const COMMON_SLUGS: Record<string, string> = {
  // Majors
  BTC: "bitcoin",
  ETH: "ethereum",
  XRP: "ripple",
  BNB: "binancecoin",
  SOL: "solana",
  ADA: "cardano",
  DOGE: "dogecoin",
  TRX: "tron",
  DOT: "polkadot",
  AVAX: "avalanche-2",
  MATIC: "polygon",
  LINK: "chainlink",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  ATOM: "cosmos",
  NEAR: "near",
  XLM: "stellar",
  UNI: "uniswap",
  ALGO: "algorand",
  XMR: "monero",
  ETC: "ethereum-classic",
  FIL: "filecoin",
  APT: "aptos",
  ARB: "arbitrum",
  OP: "optimism",
  SUI: "sui",
  INJ: "injective-protocol",
  TIA: "celestia",
  RNDR: "render-token",
  IMX: "immutable-x",
  SAND: "the-sandbox",
  MANA: "decentraland",
  AAVE: "aave",
  HBAR: "hedera-hashgraph",
  VET: "vechain",
  TON: "the-open-network",
  APE: "apecoin",
  // Stables (most people hold these)
  USDT: "tether",
  USDC: "usd-coin",
  DAI: "dai",
  TUSD: "true-usd",
};

/**
 * Resolve a ticker (e.g. "BTC", "btc") to a CoinGecko slug ("bitcoin"), or
 * null if we can't find a match.
 *
 * Strategy:
 *   1. Check our hardcoded map — fast, no network.
 *   2. Fall back to CoinGecko /search, pick the first exact-symbol match.
 *   3. Return null if nothing matches → caller should surface an error.
 */
export async function resolveCoinGeckoSlug(
  symbol: string,
): Promise<string | null> {
  const upper = symbol.trim().toUpperCase();
  if (!upper) return null;

  if (COMMON_SLUGS[upper]) return COMMON_SLUGS[upper];

  try {
    const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(
      symbol,
    )}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;

    const data = await res.json();
    // Coins array is already sorted by market cap descending. Take the first
    // exact-symbol match.
    type Hit = { id?: string; symbol?: string };
    const coins: Hit[] = data?.coins ?? [];
    const match = coins.find((c) => c.symbol?.toUpperCase() === upper);
    return match?.id ?? null;
  } catch {
    return null;
  }
}
