-- =============================================================================
-- Connected (self-custody) wallets — read-only on-chain asset sync.
--
-- The user pastes a public address (or signs in with their wallet) and we
-- auto-populate `assets` + `balance_snapshots` from on-chain balances. No
-- private keys ever touch the system. Disconnecting a wallet preserves the
-- historical snapshots by default; assets.wallet_id falls to NULL.
--
-- v1: Ethereum mainnet only. Enum leaves room to add Base/Arbitrum/etc later.
--
-- Tables:
--   connected_wallets    User's linked wallets (one per {user, chain, address}).
--   token_slug_cache     Shared cache: ERC-20 contract → CoinGecko slug.
-- =============================================================================

create type wallet_chain as enum ('ethereum');
create type wallet_connection_method as enum ('address', 'signature');

-- -----------------------------------------------------------------------------
-- connected_wallets
-- -----------------------------------------------------------------------------
create table public.connected_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  chain wallet_chain not null default 'ethereum',
  address text not null,                      -- lowercased 0x...
  ens_name text,
  label text,                                 -- user-set: "Hot wallet", ...
  connection_method wallet_connection_method not null,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index connected_wallets_user_addr_uidx
  on public.connected_wallets(user_id, chain, address);
create index connected_wallets_user_id_idx on public.connected_wallets(user_id);

comment on column public.connected_wallets.address is
  'Lowercased hex (0x...). Always lowercase at insert time so the unique index dedupes case variants.';
comment on column public.connected_wallets.connection_method is
  'How the user proved the address — paste vs SIWE signature. "address" is watch-only (no proof of ownership).';

-- -----------------------------------------------------------------------------
-- assets.wallet_id — source wallet for imported assets (NULL = manual entry)
-- -----------------------------------------------------------------------------
alter table public.assets
  add column wallet_id uuid references public.connected_wallets(id) on delete set null;
create index assets_wallet_id_idx on public.assets(wallet_id);

comment on column public.assets.wallet_id is
  'Non-null for assets auto-imported from a connected wallet. Disconnect sets this back to NULL so historical snapshots survive.';

-- -----------------------------------------------------------------------------
-- token_slug_cache — contract address → CoinGecko slug (shared, negative-cached)
-- -----------------------------------------------------------------------------
create table public.token_slug_cache (
  contract_address text primary key,   -- lowercased 0x...
  chain wallet_chain not null default 'ethereum',
  coingecko_slug text,                 -- null = "looked up, not found" (negative cache)
  symbol text,
  name text,
  decimals smallint,
  logo text,
  fetched_at timestamptz not null default now()
);

create index token_slug_cache_fetched_at_idx on public.token_slug_cache(fetched_at desc);

comment on column public.token_slug_cache.coingecko_slug is
  'NULL means CoinGecko has no record of this contract. Treated as a 7-day negative cache — skip the token from sync.';

-- =============================================================================
-- Row-Level Security
-- =============================================================================

alter table public.connected_wallets enable row level security;
alter table public.token_slug_cache  enable row level security;

-- connected_wallets: self-only CRUD, mirrors assets policies.
create policy "connected_wallets self select" on public.connected_wallets
  for select using (auth.uid() = user_id);
create policy "connected_wallets self insert" on public.connected_wallets
  for insert with check (auth.uid() = user_id);
create policy "connected_wallets self update" on public.connected_wallets
  for update using (auth.uid() = user_id);
create policy "connected_wallets self delete" on public.connected_wallets
  for delete using (auth.uid() = user_id);

-- token_slug_cache: public read, writes via service role only (mirrors price_cache).
create policy "token_slug_cache public read" on public.token_slug_cache
  for select using (true);
