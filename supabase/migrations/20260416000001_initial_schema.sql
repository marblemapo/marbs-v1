-- =============================================================================
-- Marbs v1 — Initial schema
-- Privacy-first multi-asset net-worth tracker. See DESIGN.md & REBUILD_PLAN.md.
--
-- Tables:
--   profiles              1:1 with auth.users, holds base_currency + display
--   assets                User-owned tradable things (equity / etf / crypto / cash)
--   transactions          Ledger mode — for stocks/ETFs (buy/sell/dividend/split)
--   balance_snapshots     Balance mode — for crypto/cash (point-in-time value)
--   goals                 User-defined savings targets
--   milestones            System-defined net-worth milestones (seeded later)
--   user_milestones_reached   Achievement log
--   price_cache           Shared price cache (system-owned, no per-user rows)
--   fx_rates              Shared FX rate cache (system-owned)
--
-- RLS: all user tables enforce per-user access via auth.uid().
-- System tables (price_cache, fx_rates, milestones) are read-public,
-- write-blocked-to-users (service role only).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
-- gen_random_uuid() is built into Postgres 13+ (Supabase uses 15+), no extension
-- needed. uuid-ossp is available but lives in `extensions` schema, not public's
-- search path.
-- -----------------------------------------------------------------------------
create type asset_class as enum ('equity', 'etf', 'crypto', 'cash');
create type price_source as enum ('yahoo', 'coingecko', 'finnhub', 'twelvedata', 'manual');
create type transaction_type as enum ('buy', 'sell', 'dividend', 'split');
create type balance_source as enum ('manual', 'imported');

-- -----------------------------------------------------------------------------
-- profiles  (one row per auth.users row)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  base_currency char(3) not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.base_currency is 'ISO 4217 currency code for net-worth display (e.g. USD, EUR, HKD)';

-- Auto-create profile row when a new auth.users row is inserted.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- assets  (user-owned tradable instrument)
-- -----------------------------------------------------------------------------
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  symbol text,                        -- e.g. AAPL, 0700.HK, BTC, 'USD cash'
  asset_class asset_class not null,
  native_currency char(3) not null,   -- ISO 4217 for the asset itself
  price_source price_source not null default 'manual',
  external_id text,                   -- yahoo ticker, coingecko id, etc.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assets_user_id_idx on public.assets(user_id);
create index assets_asset_class_idx on public.assets(asset_class);

comment on column public.assets.external_id is 'Lookup key for price_source (e.g. "AAPL" for yahoo, "bitcoin" for coingecko). NULL for manual/cash.';

-- -----------------------------------------------------------------------------
-- transactions  (ledger mode — stocks/ETFs where cost basis matters)
-- -----------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  type transaction_type not null,
  quantity numeric(20, 8) not null,
  price_native numeric(20, 8) not null,
  fx_rate_at_tx numeric(20, 8),        -- FX to user's base currency at tx time
  fee numeric(20, 8) not null default 0,
  occurred_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now()
);

create index transactions_asset_id_idx on public.transactions(asset_id);
create index transactions_occurred_at_idx on public.transactions(occurred_at desc);

-- -----------------------------------------------------------------------------
-- balance_snapshots  (balance mode — cash/crypto; point-in-time value)
-- -----------------------------------------------------------------------------
create table public.balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  balance_native numeric(20, 8) not null,
  snapshot_at timestamptz not null default now(),
  source balance_source not null default 'manual',
  notes text,
  created_at timestamptz not null default now()
);

create index balance_snapshots_asset_id_idx on public.balance_snapshots(asset_id);
create index balance_snapshots_snapshot_at_idx on public.balance_snapshots(snapshot_at desc);

-- Fast lookup of the latest snapshot per asset.
create index balance_snapshots_latest_idx
  on public.balance_snapshots(asset_id, snapshot_at desc);

-- -----------------------------------------------------------------------------
-- goals
-- -----------------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  target_amount numeric(20, 2) not null,
  target_currency char(3) not null,
  target_date date,
  priority smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goals_user_id_idx on public.goals(user_id);

-- -----------------------------------------------------------------------------
-- milestones  (system-defined — seeded separately)
-- -----------------------------------------------------------------------------
create table public.milestones (
  id text primary key,                 -- 'first_100k', 'first_1m', etc.
  name text not null,
  threshold_base_currency numeric(20, 2) not null,
  icon text,
  sort_order smallint not null default 0
);

create table public.user_milestones_reached (
  user_id uuid not null references public.profiles(id) on delete cascade,
  milestone_id text not null references public.milestones(id) on delete cascade,
  reached_at timestamptz not null default now(),
  primary key (user_id, milestone_id)
);

-- -----------------------------------------------------------------------------
-- price_cache  (shared — keyed by external_id + source)
-- -----------------------------------------------------------------------------
create table public.price_cache (
  external_id text not null,
  source price_source not null,
  price_native numeric(20, 8) not null,
  currency char(3) not null,
  fetched_at timestamptz not null default now(),
  primary key (external_id, source)
);

create index price_cache_fetched_at_idx on public.price_cache(fetched_at desc);

-- -----------------------------------------------------------------------------
-- fx_rates  (shared — ISO 4217 pairs)
-- -----------------------------------------------------------------------------
create table public.fx_rates (
  base char(3) not null,
  quote char(3) not null,
  rate numeric(20, 8) not null,
  fetched_at timestamptz not null default now(),
  primary key (base, quote)
);

create index fx_rates_fetched_at_idx on public.fx_rates(fetched_at desc);

-- -----------------------------------------------------------------------------
-- updated_at trigger helper
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger assets_set_updated_at before update on public.assets
  for each row execute function public.set_updated_at();
create trigger goals_set_updated_at before update on public.goals
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Row-Level Security
-- =============================================================================

alter table public.profiles              enable row level security;
alter table public.assets                enable row level security;
alter table public.transactions          enable row level security;
alter table public.balance_snapshots     enable row level security;
alter table public.goals                 enable row level security;
alter table public.milestones            enable row level security;
alter table public.user_milestones_reached enable row level security;
alter table public.price_cache           enable row level security;
alter table public.fx_rates              enable row level security;

-- profiles: self-only
create policy "profiles self select" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles self update" on public.profiles
  for update using (auth.uid() = id);

-- assets: self-only CRUD
create policy "assets self select" on public.assets
  for select using (auth.uid() = user_id);
create policy "assets self insert" on public.assets
  for insert with check (auth.uid() = user_id);
create policy "assets self update" on public.assets
  for update using (auth.uid() = user_id);
create policy "assets self delete" on public.assets
  for delete using (auth.uid() = user_id);

-- transactions: ownership via asset_id → assets.user_id chain
create policy "transactions self select" on public.transactions
  for select using (exists (
    select 1 from public.assets a where a.id = asset_id and a.user_id = auth.uid()
  ));
create policy "transactions self insert" on public.transactions
  for insert with check (exists (
    select 1 from public.assets a where a.id = asset_id and a.user_id = auth.uid()
  ));
create policy "transactions self update" on public.transactions
  for update using (exists (
    select 1 from public.assets a where a.id = asset_id and a.user_id = auth.uid()
  ));
create policy "transactions self delete" on public.transactions
  for delete using (exists (
    select 1 from public.assets a where a.id = asset_id and a.user_id = auth.uid()
  ));

-- balance_snapshots: same ownership chain
create policy "balance_snapshots self select" on public.balance_snapshots
  for select using (exists (
    select 1 from public.assets a where a.id = asset_id and a.user_id = auth.uid()
  ));
create policy "balance_snapshots self insert" on public.balance_snapshots
  for insert with check (exists (
    select 1 from public.assets a where a.id = asset_id and a.user_id = auth.uid()
  ));
create policy "balance_snapshots self update" on public.balance_snapshots
  for update using (exists (
    select 1 from public.assets a where a.id = asset_id and a.user_id = auth.uid()
  ));
create policy "balance_snapshots self delete" on public.balance_snapshots
  for delete using (exists (
    select 1 from public.assets a where a.id = asset_id and a.user_id = auth.uid()
  ));

-- goals: self-only CRUD
create policy "goals self select" on public.goals
  for select using (auth.uid() = user_id);
create policy "goals self insert" on public.goals
  for insert with check (auth.uid() = user_id);
create policy "goals self update" on public.goals
  for update using (auth.uid() = user_id);
create policy "goals self delete" on public.goals
  for delete using (auth.uid() = user_id);

-- milestones: public read, no user writes (seed only via service role)
create policy "milestones public read" on public.milestones
  for select using (true);

-- user_milestones_reached: self read only. Writes happen via service role
-- when a net-worth snapshot crosses a threshold.
create policy "user_milestones self select" on public.user_milestones_reached
  for select using (auth.uid() = user_id);

-- price_cache + fx_rates: public read, no user writes (writes via service role).
create policy "price_cache public read" on public.price_cache
  for select using (true);
create policy "fx_rates public read" on public.fx_rates
  for select using (true);
