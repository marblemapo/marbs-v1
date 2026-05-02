-- =============================================================================
-- Net worth history infrastructure.
--
-- Three new tables power the trend view on the dashboard:
--
--   net_worth_snapshots   Daily pre-aggregated total per user, in USD.
--                         Converted to user's base_currency at read time.
--                         Source of truth for the chart.
--
--   price_history         Daily price points per asset, append-only. Cached
--                         across users so the second user holding BTC reuses
--                         the first user's backfill.
--
--   fx_rate_history       Daily FX rates between currency pairs. Powers
--                         cross-currency historicals (e.g. cash held in EUR).
--
-- All three are append-only: we never mutate past rows. Backfill writes use
-- `on conflict do nothing`. RLS pattern follows price_cache / fx_rates from
-- the initial schema — public read for shared tables, self read for the
-- per-user table. All writes via service role.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- net_worth_snapshots  (per-user, daily total in USD)
-- -----------------------------------------------------------------------------
create table public.net_worth_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,                          -- UTC
  total_usd numeric(20, 2) not null,
  breakdown_usd jsonb,                                  -- { equity, etf, crypto, cash }
  is_backfilled boolean not null default false,         -- true for synthetic pre-onboarding rows
  coverage_pct numeric(5, 4) not null default 1,        -- fraction of today's portfolio covered by price data on this date
  computed_at timestamptz not null default now(),
  primary key (user_id, snapshot_date)
);

create index net_worth_snapshots_user_date_idx
  on public.net_worth_snapshots(user_id, snapshot_date desc);

-- -----------------------------------------------------------------------------
-- price_history  (shared — daily prices per asset)
-- -----------------------------------------------------------------------------
create table public.price_history (
  external_id text not null,
  source price_source not null,
  observation_date date not null,
  price_native numeric(20, 8) not null,
  native_currency char(3) not null,
  primary key (external_id, source, observation_date)
);

create index price_history_lookup_idx
  on public.price_history(external_id, source, observation_date desc);

-- -----------------------------------------------------------------------------
-- fx_rate_history  (shared — daily FX rates per currency pair)
-- -----------------------------------------------------------------------------
create table public.fx_rate_history (
  base char(3) not null,
  quote char(3) not null,
  observation_date date not null,
  rate numeric(20, 8) not null,
  primary key (base, quote, observation_date)
);

create index fx_rate_history_lookup_idx
  on public.fx_rate_history(base, quote, observation_date desc);

-- =============================================================================
-- Row-Level Security
-- =============================================================================

alter table public.net_worth_snapshots enable row level security;
alter table public.price_history       enable row level security;
alter table public.fx_rate_history     enable row level security;

-- net_worth_snapshots: self read only. Writes happen via service role.
create policy "net_worth_snapshots self select" on public.net_worth_snapshots
  for select using (auth.uid() = user_id);

-- price_history + fx_rate_history: public read, no user writes (writes via service role).
create policy "price_history public read" on public.price_history
  for select using (true);
create policy "fx_rate_history public read" on public.fx_rate_history
  for select using (true);
