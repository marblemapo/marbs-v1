import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarRail } from "@/components/clarity/sidebar-rail";
import { DangerZone } from "@/components/danger-zone";

// Placeholder Settings surface — currently just houses DangerZone (the delete-
// account flow) so it stays reachable after being pulled off the Overview.
// Full settings pass will come with a dedicated handoff.

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();
  const displayName =
    profile?.display_name || user.email?.split("@")[0] || "You";

  return (
    <div className="clarity-shell flex-1 flex font-sans text-white">
      <SidebarRail active="settings" displayName={displayName} />
      <main className="flex-1 min-w-0 overflow-y-auto px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-[26px] pb-6">
        <div className="mx-auto max-w-[900px]">
          <header className="mb-8">
            <div className="hidden md:block text-[13px] text-[#7d8085]">Account</div>
            <div className="font-display font-bold text-[22px] text-white">
              Settings
            </div>
          </header>
          <form action="/auth/signout" method="POST" className="mb-10">
            <button
              type="submit"
              className="font-mono text-[13px] text-[#8a8d92] hover:text-white transition-colors"
            >
              Sign out →
            </button>
          </form>
          {user.email && <DangerZone email={user.email} />}
        </div>
      </main>
    </div>
  );
}
