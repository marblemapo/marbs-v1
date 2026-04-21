/**
 * Alchemy wrappers — ERC-20 + native ETH balance reads for a single address.
 * Server-only: reads process.env.ALCHEMY_API_KEY which never leaves the server.
 *
 * Two methods we rely on:
 *   - alchemy_getTokenBalances(address, 'erc20')  → all non-zero ERC-20 holdings in one call
 *   - alchemy_getTokenMetadata(contract)          → name/symbol/decimals/logo per token
 *   - eth_getBalance(address, 'latest')           → native ETH
 *
 * Free tier (300M CU/mo) covers us easily at v1 volume.
 */

const ALCHEMY_BASE = "https://eth-mainnet.g.alchemy.com/v2";

function alchemyUrl(): string {
  const key = process.env.ALCHEMY_API_KEY;
  if (!key) throw new Error("ALCHEMY_API_KEY is not set");
  return `${ALCHEMY_BASE}/${key}`;
}

type JsonRpcResponse<T> = {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string };
};

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(alchemyUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Alchemy ${method} HTTP ${res.status}`);
  const json = (await res.json()) as JsonRpcResponse<T>;
  if (json.error) throw new Error(`Alchemy ${method}: ${json.error.message}`);
  if (json.result === undefined) throw new Error(`Alchemy ${method}: empty result`);
  return json.result;
}

export type TokenBalance = {
  contractAddress: string;   // lowercased 0x...
  balance: bigint;           // raw uint256
};

export async function getEthBalance(address: string): Promise<bigint> {
  const hex = await rpc<string>("eth_getBalance", [address, "latest"]);
  return BigInt(hex);
}

/**
 * Return all non-zero ERC-20 balances for the address. Alchemy streams up to
 * 100 per page; for v1 we take the first page (covers ~99% of retail wallets).
 */
export async function getErc20Balances(address: string): Promise<TokenBalance[]> {
  type Raw = {
    address: string;
    tokenBalances: { contractAddress: string; tokenBalance: string; error?: string | null }[];
  };
  const result = await rpc<Raw>("alchemy_getTokenBalances", [address, "erc20"]);
  const out: TokenBalance[] = [];
  for (const tb of result.tokenBalances ?? []) {
    if (tb.error) continue;
    try {
      const bn = BigInt(tb.tokenBalance);
      if (bn === BigInt(0)) continue;
      out.push({
        contractAddress: tb.contractAddress.toLowerCase(),
        balance: bn,
      });
    } catch {
      // Malformed hex — skip.
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

export async function getTokenMetadata(contract: string): Promise<TokenMetadata> {
  const raw = await rpc<TokenMetadata>("alchemy_getTokenMetadata", [contract]);
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
