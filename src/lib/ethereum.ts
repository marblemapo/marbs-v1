/**
 * viem helpers — server-side ENS resolution, address validation, and SIWE
 * (Sign-In With Ethereum) message build + verify.
 *
 * For balance reads we use Alchemy directly (see src/lib/alchemy.ts) because
 * getTokenBalances is a provider-specific extension, not a standard JSON-RPC
 * method. viem is used for the things viem is best at: address/ENS helpers
 * and signature verification.
 */

import { createPublicClient, http, isAddress, getAddress, verifyMessage } from "viem";
import { mainnet } from "viem/chains";
import { randomBytes } from "crypto";

/** Public mainnet client, used for ENS only. Re-created per-request is cheap. */
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

  // ENS: anything with a dot that isn't a hex address.
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

// -----------------------------------------------------------------------------
// SIWE — minimal EIP-4361 implementation
// -----------------------------------------------------------------------------
// We don't need full EIP-4361 parsing — we only need to build a canonical
// message, send it to the wallet for signing, and verify on return. viem's
// `verifyMessage` does the hard crypto; we just have to reconstruct the same
// bytes the user signed.

export type SiweFields = {
  domain: string;        // e.g. "wealth.marbs.io"
  address: string;       // checksummed 0x...
  uri: string;           // e.g. "https://wealth.marbs.io"
  version: "1";
  chainId: number;       // 1 for mainnet
  nonce: string;         // single-use, server-generated
  issuedAt: string;      // ISO 8601
  statement?: string;
};

/** Build the exact EIP-4361 text the wallet will sign. */
export function buildSiweMessage(fields: SiweFields): string {
  const header = `${fields.domain} wants you to sign in with your Ethereum account:\n${fields.address}`;
  const body = fields.statement ? `\n\n${fields.statement}\n` : "\n";
  const tail = [
    `URI: ${fields.uri}`,
    `Version: ${fields.version}`,
    `Chain ID: ${fields.chainId}`,
    `Nonce: ${fields.nonce}`,
    `Issued At: ${fields.issuedAt}`,
  ].join("\n");
  return `${header}${body}\n${tail}`;
}

/** Generate a hex nonce. Store server-side, single-use. */
export function generateNonce(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Verify an EIP-4361 signature. Caller is responsible for checking that the
 * nonce was issued + is unused, and that `issuedAt` is recent enough.
 */
export async function verifySiweSignature(params: {
  message: string;
  signature: `0x${string}`;
  expectedAddress: string;
}): Promise<boolean> {
  try {
    return await verifyMessage({
      address: getAddress(params.expectedAddress),
      message: params.message,
      signature: params.signature,
    });
  } catch {
    return false;
  }
}

export { isAddress };
