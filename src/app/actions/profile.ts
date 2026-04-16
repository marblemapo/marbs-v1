"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type UpdateProfileResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Updates the current user's display_name in profiles.
 * RLS restricts the update to the user's own row (auth.uid() = id).
 *
 * Passing empty/whitespace sets display_name to NULL so the fallback
 * (email prefix) kicks back in on the dashboard.
 */
export async function updateDisplayName(
  name: string,
): Promise<UpdateProfileResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const trimmed = name.trim();
  if (trimmed.length > 60)
    return { ok: false, error: "Name must be 60 characters or fewer" };

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: trimmed || null })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}
