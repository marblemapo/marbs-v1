import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/components/onboarding-wizard";

// Always re-render so profile / asset counts are live.
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, base_currency")
    .eq("id", user.id)
    .single();

  const displayName =
    profile?.display_name ?? user.email?.split("@")[0] ?? "there";
  const baseCurrency = profile?.base_currency ?? "USD";

  return (
    <OnboardingWizard
      displayName={displayName}
      baseCurrency={baseCurrency}
    />
  );
}
