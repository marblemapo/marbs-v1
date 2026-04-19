-- Store the previous-close (~24h ago) alongside the latest price so we can
-- compute a daily delta on the dashboard without a second provider round-trip.
--
-- Backfill: left NULL on existing rows. Dashboard treats NULL as "refresh
-- required" and repopulates on the next price-cache refresh cycle.

alter table price_cache
  add column if not exists previous_native numeric;

comment on column price_cache.previous_native is
  'Previous close (~24h ago) in the native currency. NULL until refreshed.';
