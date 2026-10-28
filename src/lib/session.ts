import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Per-request memoised auth + profile lookups.
//
// Before: every signed-in page called supabase.auth.getUser() itself, then
// getHoldingsReport() called it again, and each fetched `profiles` separately.
// getUser() is a network round-trip to Supabase Auth, so a single page load
// paid for 2–3 auth calls and 2 profile queries back-to-back.
//
// React cache() dedupes within one server render, so pages and
// getHoldingsReport() now share a single result.
//
// getClaims() verifies the JWT locally when the project uses asymmetric JWT
// signing keys (no network). With legacy symmetric keys it falls back to
// getUser() internally, so it is never slower than before.

export type SessionUser = { id: string; email: string | null };

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
});

export type Profile = {
  display_name: string | null;
  base_currency: string | null;
};

export const getProfile = cache(
  async (userId: string): Promise<Profile | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("display_name, base_currency")
      .eq("id", userId)
      .single();
    return data ?? null;
  },
);

export function displayNameFor(
  user: SessionUser,
  profile: Profile | null,
): string {
  return profile?.display_name || user.email?.split("@")[0] || "You";
}
