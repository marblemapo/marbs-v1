import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles the redirect from a Supabase magic link.
 *
 * Flow:
 *   1. User clicks link in email  →  Supabase redirects here with `?code=...`
 *   2. We exchange the code for a session via PKCE
 *   3. Supabase sets auth cookies  →  user is signed in
 *   4. We redirect to `?next=` (dashboard by default)
 *
 * If the exchange fails (expired/reused code), we redirect to /login with an error.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    // Log on the server; don't leak error details in the URL.
    console.error("auth/callback exchange failed:", error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=link_expired`);
}
