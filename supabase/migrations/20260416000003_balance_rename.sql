-- =============================================================================
-- Clarify balance_snapshots semantics.
--
-- `balance_native` was ambiguous: for cash it meant "amount in currency",
-- for stocks/crypto it would have meant "quantity held." Rename to
-- `quantity` — uniformly "how much of this asset the user holds", regardless
-- of class:
--
--   Cash (native_currency = USD):   quantity = 12000   → USD 12,000
--   Stock (native_currency = USD):  quantity = 100     → 100 shares AAPL
--   Crypto (native_currency = USD): quantity = 2.5     → 2.5 BTC
--
-- Value = quantity × live price (from price_cache, or implicit 1 for cash).
-- Cross-currency totals apply FX from fx_rates.
--
-- Safe-to-rerun: uses IF EXISTS.
-- =============================================================================

alter table public.balance_snapshots
  rename column balance_native to quantity;
