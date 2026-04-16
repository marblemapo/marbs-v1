import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS. SERVER ONLY.
 *
 * Use ONLY for:
 *   - Writing to shared caches (price_cache, fx_rates) that have public-read
 *     / no-user-write RLS policies.
 *   - Admin/cron jobs (backfill prices, daily snapshots).
 *
 * NEVER:
 *   - Import this into a Client Component.
 *   - Use it for per-user reads/writes where RLS should enforce isolation.
 *
 * The service-role key is in SUPABASE_SERVICE_ROLE_KEY (not NEXT_PUBLIC_*).
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
