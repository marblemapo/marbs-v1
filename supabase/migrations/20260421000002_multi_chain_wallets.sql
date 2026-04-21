-- =============================================================================
-- Multi-chain wallet support.
--
-- v1 indexed Ethereum mainnet only. v2 adds Base, Arbitrum, Optimism, Polygon,
-- and BNB Chain. An EVM address is identical across all chains, so a wallet
-- is now keyed by (user_id, address) rather than (user_id, chain, address).
-- We still track the chain on each `token_slug_cache` row because the same
-- contract address can represent different tokens on different chains.
--
-- Assets aggregate across chains by CoinGecko slug: USDT-on-Ethereum and
-- USDT-on-BSC merge into one "USDT" asset with summed quantity. Per-chain
-- breakdown lives in assets.metadata.chains.
-- =============================================================================

-- Add the new enum values. ALTER TYPE ADD VALUE can't run inside a
-- transaction in some Postgres versions; Supabase's SQL editor runs each
-- statement as its own implicit transaction so we're fine.
alter type wallet_chain add value if not exists 'base';
alter type wallet_chain add value if not exists 'arbitrum';
alter type wallet_chain add value if not exists 'optimism';
alter type wallet_chain add value if not exists 'polygon';
alter type wallet_chain add value if not exists 'bsc';

-- connected_wallets: chain is no longer meaningful (one wallet per address,
-- syncs all supported chains). Drop the column + reshape the unique index.
drop index if exists connected_wallets_user_addr_uidx;
alter table public.connected_wallets drop column if exists chain;
create unique index connected_wallets_user_addr_uidx
  on public.connected_wallets(user_id, address);

-- token_slug_cache: same contract address can exist on multiple chains with
-- different tokens (e.g. USDT on ETH ≠ USDT on Tron even if addresses look
-- similar). Upgrade the PK to (chain, contract_address).
alter table public.token_slug_cache drop constraint if exists token_slug_cache_pkey;
alter table public.token_slug_cache
  add constraint token_slug_cache_pkey primary key (chain, contract_address);
