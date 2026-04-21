/**
 * viem helpers — server-side ENS resolution + address validation.
 *
 * Balance reads go through Alchemy (see src/lib/alchemy.ts). viem handles
 * the things it's best at: address normalization and ENS lookups.
 */

import { createPublicClient, http, isAddress, getAddress } from "viem";
import { mainnet } from "viem/chains";

/** Public mainnet client, used for ENS only. */
function mainnetClient() {
  const alchemyKey = process.env.ALCHEMY_API_KEY;
  const rpcUrl = alchemyKey
    ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`
    : undefined; // viem falls back to its built-in public RPC if undefined
  return createPublicClient({ chain: mainnet, transport: http(rpcUrl) });
}

/**
 * Resolve either a hex address or an ENS name to a canonical lowercased 0x
 * address. Returns null if the input is neither a valid address nor a
 * resolvable ENS name.
 */
export async function resolveAddressOrEns(
  input: string,
): Promise<{ address: string; ensName: string | null } | null> {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (isAddress(trimmed)) {
    return { address: trimmed.toLowerCase(), ensName: null };
  }

  if (!trimmed.includes(".")) return null;

  try {
    const client = mainnetClient();
    const resolved = await client.getEnsAddress({ name: trimmed });
    if (!resolved) return null;
    return { address: resolved.toLowerCase(), ensName: trimmed.toLowerCase() };
  } catch {
    return null;
  }
}

/**
 * Try to reverse-resolve an address to an ENS name. Best-effort — returns null
 * on any failure. Used to show "vitalik.eth" instead of "0xd8dA..." in the UI.
 */
export async function lookupEnsName(address: string): Promise<string | null> {
  try {
    const client = mainnetClient();
    const name = await client.getEnsName({ address: getAddress(address) });
    return name ?? null;
  } catch {
    return null;
  }
}

export { isAddress };
