"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Hard-delete the current user's account and everything it owns.
 *
 * Cascade path: `auth.users.id → profiles.id` is `ON DELETE CASCADE`, and
 * every user-owned table hangs off `profiles.id` with its own cascade. So
 * a single `auth.admin.deleteUser` wipes the whole tree:
 *   assets → balance_snapshots + transactions
 *   connected_wallets → (assets.wallet_id falls to NULL, but those assets
 *     are gone anyway via their own cascade)
 *   goals, user_milestones_reached — same pattern
 *
 * Shared caches (`price_cache`, `fx_rates`, `token_slug_cache`, `milestones`)
 * have no user_id so nothing to prune.
 *
 * Email confirmation: caller must pass the user's own email as a typed
 * confirmation — an escape hatch against a stray click on the delete button.
 *
 * After deleting, we `redirect("/")` so the user lands on marketing. Their
 * session cookie is now orphaned (the auth.users row is gone), and the
 * redirect response tells the browser to go home. Next request will treat
 * them as logged-out.
 */
export async function deleteAccount(
  confirmEmail: string,
): Promise<DeleteAccountResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  if (
    confirmEmail.trim().toLowerCase() !==
    (user.email ?? "").trim().toLowerCase()
  ) {
    return {
      ok: false,
      error: "Email doesn't match the address on this account.",
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, error: error.message };

  // Best-effort: clear the session cookie. If this throws because the
  // session is already invalid (auth.users row is gone), the redirect
  // still happens — the next request just won't have a valid user.
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore
  }

  redirect("/");
}
