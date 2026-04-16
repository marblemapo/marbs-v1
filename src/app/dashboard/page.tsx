import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defence in depth — proxy.ts should have already redirected. This is the
  // server-component guarantee.
  if (!user) redirect("/login");

  // Fetch the profile row auto-created by the `handle_new_user` trigger.
  // RLS ensures we can only read our own row.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, base_currency, created_at")
    .eq("id", user.id)
    .single();

  return (
    <main className="flex flex-1 flex-col items-center px-6">
      <div className="w-full max-w-[720px] flex flex-col gap-10 py-16">
        {/* Header */}
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-text-muted uppercase tracking-wider font-medium">
              Dashboard
            </span>
            <h1 className="font-display text-3xl font-bold leading-none tracking-tight">
              Hello, <span className="text-gold">{profile?.display_name ?? user.email}</span>
            </h1>
          </div>
          <form action="/auth/signout" method="POST">
            <Button type="submit" variant="ghost" size="sm" className="font-medium">
              Sign out
            </Button>
          </form>
        </header>

        {/* Net-worth hero — placeholder, no data yet */}
        <section className="flex flex-col gap-2 p-6 rounded-lg bg-surface border border-border">
          <div className="text-[11px] text-text-muted uppercase tracking-wider font-medium">
            Net worth · {profile?.base_currency ?? "USD"}
          </div>
          <div className="font-display text-5xl font-bold tabular-nums">
            {profile?.base_currency === "USD" ? "$" : ""}—
          </div>
          <div className="text-sm text-text-muted">
            Add your first asset to see your net worth.
          </div>
        </section>

        {/* Status */}
        <section className="flex flex-col gap-3 text-sm">
          <div className="flex items-center gap-2 text-text-secondary">
            <span className="w-1.5 h-1.5 rounded-full bg-gain" />
            Signed in · profile created {profile?.created_at
              ? new Date(profile.created_at).toLocaleString()
              : "unknown"}
          </div>
          {profileError ? (
            <div className="text-loss">
              Profile error: {profileError.message}
            </div>
          ) : (
            <div className="text-text-muted">
              Your profile row exists in Supabase. Next up: asset CRUD.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
