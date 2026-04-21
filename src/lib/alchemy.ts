/**
 * Alchemy wrappers — native + ERC-20 balance reads across all supported
 * EVM chains. Server-only: reads process.env.ALCHEMY_API_KEY which never
 * leaves the server.
 *
 * Three methods we rely on:
 *   - alchemy_getTokenBalances(address, 'erc20')  → all non-zero ERC-20s
 *   - alchemy_getTokenMetadata(contract)          → name/symbol/decimals/logo
 *   - eth_getBalance(address, 'latest')           → native coin (ETH/BNB/MATIC)
 *
 * Alchemy's free tier covers all listed chains on a single key.
 */

export type Chain =
  | "ethereum"
  | "base"
  | "arbitrum"
  | "optimism"
  | "polygon"
  | "bsc";

export const SUPPORTED_CHAINS: Chain[] = [
  "ethereum",
  "base",
  "arbitrum",
  "optimism",
  "polygon",
  "bsc",
];

/** Alchemy subdomain per chain. https://docs.alchemy.com/reference/api-overview */
const ALCHEMY_HOST: Record<Chain, string> = {
  ethereum: "eth-mainnet.g.alchemy.com",
  base: "base-mainnet.g.alchemy.com",
  arbitrum: "arb-mainnet.g.alchemy.com",
  optimism: "opt-mainnet.g.alchemy.com",
  polygon: "polygon-mainnet.g.alchemy.com",
  bsc: "bnb-mainnet.g.alchemy.com",
};

/**
 * Native coin metadata per chain. The native coin isn't an ERC-20 contract —
 * it's the chain's gas asset. We price it via CoinGecko using a fixed slug
 * and display it with a fixed ticker.
 */
export const NATIVE_COIN: Record<
  Chain,
  { slug: string; symbol: string; name: string; decimals: 18 }
> = {
  ethereum: { slug: "ethereum", symbol: "ETH", name: "Ethereum", decimals: 18 },
  base: { slug: "ethereum", symbol: "ETH", name: "Ethereum (Base)", decimals: 18 },
  arbitrum: {
    slug: "ethereum",
    symbol: "ETH",
    name: "Ethereum (Arbitrum)",
    decimals: 18,
  },
  optimism: {
    slug: "ethereum",
    symbol: "ETH",
    name: "Ethereum (Optimism)",
    decimals: 18,
  },
  polygon: {
    slug: "matic-network",
    symbol: "MATIC",
    name: "Polygon",
    decimals: 18,
  },
  bsc: { slug: "binancecoin", symbol: "BNB", name: "BNB", decimals: 18 },
};

export const CHAIN_LABEL: Record<Chain, string> = {
  ethereum: "Ethereum",
  base: "Base",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  polygon: "Polygon",
  bsc: "BNB Chain",
};

function alchemyUrl(chain: Chain): string {
  const key = process.env.ALCHEMY_API_KEY;
  if (!key) throw new Error("ALCHEMY_API_KEY is not set");
  return `https://${ALCHEMY_HOST[chain]}/v2/${key}`;
}

type JsonRpcResponse<T> = {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string };
};

async function rpc<T>(chain: Chain, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(alchemyUrl(chain), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Alchemy ${chain} ${method} HTTP ${res.status}`);
  const json = (await res.json()) as JsonRpcResponse<T>;
  if (json.error) throw new Error(`Alchemy ${chain} ${method}: ${json.error.message}`);
  if (json.result === undefined) {
    throw new Error(`Alchemy ${chain} ${method}: empty result`);
  }
  return json.result;
}

export type TokenBalance = {
  contractAddress: string; // lowercased 0x...
  balance: bigint; // raw uint256
};

export async function getNativeBalance(chain: Chain, address: string): Promise<bigint> {
  const hex = await rpc<string>(chain, "eth_getBalance", [address, "latest"]);
  return BigInt(hex);
}

/**
 * All non-zero ERC-20 (and on BSC, BEP-20) balances for the address. Alchemy
 * streams up to 100 per page; for v1 we take the first page.
 */
export async function getErc20Balances(
  chain: Chain,
  address: string,
): Promise<TokenBalance[]> {
  type Raw = {
    address: string;
    tokenBalances: {
      contractAddress: string;
      tokenBalance: string;
      error?: string | null;
    }[];
  };
  const result = await rpc<Raw>(chain, "alchemy_getTokenBalances", [address, "erc20"]);
  const out: TokenBalance[] = [];
  for (const tb of result.tokenBalances ?? []) {
    if (tb.error) continue;
    try {
      const bn = BigInt(tb.tokenBalance);
      if (bn === BigInt(0)) continue;
      out.push({ contractAddress: tb.contractAddress.toLowerCase(), balance: bn });
    } catch {
      // malformed hex — skip
    }
  }
  return out;
}

export type TokenMetadata = {
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  logo: string | null;
};

export async function getTokenMetadata(
  chain: Chain,
  contract: string,
): Promise<TokenMetadata> {
  const raw = await rpc<TokenMetadata>(chain, "alchemy_getTokenMetadata", [contract]);
  return {
    name: raw.name ?? null,
    symbol: raw.symbol ?? null,
    decimals: typeof raw.decimals === "number" ? raw.decimals : null,
    logo: raw.logo ?? null,
  };
}

/** Convert a raw uint256 balance to a decimal float. Returns 0 on bad decimals. */
export function formatUnits(balance: bigint, decimals: number): number {
  if (!Number.isFinite(decimals) || decimals < 0 || decimals > 36) return 0;
  if (decimals === 0) return Number(balance);
  const str = balance.toString().padStart(decimals + 1, "0");
  const whole = str.slice(0, -decimals);
  const frac = str.slice(-decimals);
  return Number(`${whole}.${frac}`);
}
