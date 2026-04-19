import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatCell } from "@/components/f3/stat-cell";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="f3-stage flex-1 flex items-center">
      <div className="mx-auto w-full max-w-[780px] px-6 py-12 flex flex-col f3-fade-in">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill bg-white/[0.04] border border-white/[0.08] font-plex text-[12px] font-medium text-[#EBEBF5] tracking-wide">
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#7FFFD4] f3-pulse"
              style={{ boxShadow: "0 0 10px #7FFFD4" }}
            />
            0xMARBS···v1
          </div>
          <nav className="flex items-center gap-6 font-plex text-[12px] font-medium text-text-muted">
            <span className="text-foreground">Home</span>
            <a
              href="https://github.com/marblemapo/marbs-v1"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Docs
            </a>
            <Link
              href={user ? "/dashboard" : "/login"}
              className="hover:text-foreground transition-colors"
            >
              {user ? "Dashboard" : "Sign in"}
            </Link>
          </nav>
        </div>

        {/* Hero */}
        <h1 className="font-sans font-bold text-5xl md:text-[48px] leading-[1.02] tracking-[-0.03em] mb-4">
          Your net worth,
          <br />
          <span className="text-[#7FFFD4]">private by default.</span>
        </h1>
        <p className="font-plex text-sm text-text-muted max-w-[460px] mb-10">
          {"// self-custody your numbers. stocks, crypto, cash. no bank logins, no plaid."}
        </p>

        {/* CTA */}
        <div className="flex items-center gap-4 mb-12">
          <Link
            href={user ? "/dashboard" : "/login"}
            className="f3-cta"
          >
            {user ? "Enter vault →" : "Sign in"}
          </Link>
          <span className="font-plex text-[12px] text-text-muted">
            {user ? `signed in as ${user.email}` : "Magic link · no password"}
          </span>
        </div>

        {/* Interactive empty-state stats strip */}
        <div className="grid grid-cols-3 gap-px bg-white/[0.08] rounded-[14px] overflow-hidden">
          <StatCell
            label="Net worth"
            target={2184729.84}
            prefix="$"
            decimals={2}
            cta="Add your first asset"
            href="/login"
            emptyDisplay="$—"
            mountDelay={300}
          />
          <StatCell
            label="Today"
            target={18429.52}
            prefix="+$"
            decimals={2}
            cta="See live movement"
            href="/login"
            positive
            emptyDisplay="+$—"
            mountDelay={450}
          />
          <StatCell
            label="Assets"
            target={12}
            decimals={0}
            cta="Start tracking"
            href="/login"
            emptyDisplay="0"
            mountDelay={600}
          />
        </div>
      </div>
    </main>
  );
}
