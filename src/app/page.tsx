import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="w-full max-w-[720px] flex flex-col gap-10 py-24">
        {/* Brand pill */}
        <span className="inline-flex self-start items-center gap-1.5 bg-gold-dim text-gold text-[11px] font-semibold px-2.5 py-1 rounded-pill uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-gold pulse-live" />
          Marbs v1 · in development
        </span>

        {/* Hero */}
        <div className="flex flex-col gap-4">
          <h1 className="font-display text-5xl md:text-6xl font-bold leading-none tracking-tight">
            Your net worth,
            <br />
            <span className="text-gold">private by default.</span>
          </h1>
          <p className="text-lg leading-relaxed text-text-secondary max-w-[560px]">
            A beautiful multi-asset tracker for stocks, crypto, and cash.
            No bank logins. No Plaid. Just your numbers.
          </p>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <Link
            href={user ? "/dashboard" : "/login"}
            className={cn(buttonVariants(), "h-11 px-5 font-semibold")}
          >
            {user ? "Go to dashboard" : "Sign in"}
          </Link>
          <span className="text-xs text-text-muted">
            {user ? `Signed in as ${user.email}` : "Magic link · no password"}
          </span>
        </div>

        {/* Stats preview — tokens in action */}
        <div className="grid grid-cols-3 gap-px bg-border rounded-lg overflow-hidden">
          <div className="bg-surface p-5 flex flex-col gap-1">
            <div className="text-[11px] text-text-muted uppercase tracking-wider font-medium">Net worth</div>
            <div className="font-display text-2xl font-bold tabular-nums">$—</div>
          </div>
          <div className="bg-surface p-5 flex flex-col gap-1">
            <div className="text-[11px] text-text-muted uppercase tracking-wider font-medium">Today</div>
            <div className="font-display text-2xl font-bold tabular-nums text-gain">+$—</div>
          </div>
          <div className="bg-surface p-5 flex flex-col gap-1">
            <div className="text-[11px] text-text-muted uppercase tracking-wider font-medium">Assets</div>
            <div className="font-display text-2xl font-bold tabular-nums">0</div>
          </div>
        </div>
      </div>
    </main>
  );
}
