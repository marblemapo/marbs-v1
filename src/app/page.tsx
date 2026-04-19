import type { Metadata } from "next";
import { headers } from "next/headers";
import { PersonalHome } from "@/components/personal-home";
import { WealthLanding } from "@/components/wealth-landing";

// marbs.io   → personal site (default)
// wealth.marbs.io → wealth-tracker marketing page
// In dev, force the wealth variant with ?host=wealth for quick previewing.
function isWealthHost(host: string, searchHost: string | null) {
  if (searchHost === "wealth") return true;
  return host.startsWith("wealth.");
}

async function resolveVariant(searchParams: Promise<{ host?: string }>) {
  const h = await headers();
  const { host: searchHost } = await searchParams;
  const host = (h.get("host") ?? "").toLowerCase();
  return isWealthHost(host, searchHost ?? null) ? "wealth" : "personal";
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ host?: string }>;
}): Promise<Metadata> {
  const variant = await resolveVariant(searchParams);
  if (variant === "wealth") {
    return {
      title: "Wealth — Your net worth, private by default",
      description:
        "A beautiful, privacy-first multi-asset net-worth tracker. Stocks, crypto, cash — in one place. No bank logins.",
    };
  }
  return {
    title: "Marble Ma — marbs.io",
    description:
      "Program manager, problem-solver, and builder. Strategy and operations across FinTech, financial services, and digital assets.",
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ host?: string }>;
}) {
  const variant = await resolveVariant(searchParams);
  if (variant === "wealth") return <WealthLanding />;
  return <PersonalHome />;
}
