import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Paths that require a signed-in user. All subpaths are protected too.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/holdings",
  "/insights",
  "/settings",
  "/onboarding",
];

// Paths that only make sense when logged OUT. Signed-in visitors are bounced
// to the dashboard.
const AUTH_ONLY_PATHS = ["/login"];

/**
 * Runs on every request (except static assets — see matcher in /src/proxy.ts).
 *
 * Does two jobs:
 *   1. Refreshes the Supabase auth session via cookies (must stay — without
 *      this, tokens expire silently and users get logged out).
 *   2. Enforces auth guards: protected pages redirect to /login, login page
 *      redirects to /dashboard if the user is already signed in.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touch the session to refresh it if needed. getClaims() refreshes an
  // expired session like getUser() does, but verifies the JWT locally when
  // the project uses asymmetric signing keys instead of calling Supabase Auth
  // on every request (it falls back to getUser() with legacy symmetric keys).
  // This runs before every page render, so it was a fixed round-trip on each
  // navigation.
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? claimsData.claims : null;

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthOnly = AUTH_ONLY_PATHS.includes(pathname);

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthOnly && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
