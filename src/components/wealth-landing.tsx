import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LandingDemo } from "@/components/landing-demo";

// Wealth-tracker marketing page. Served at wealth.marbs.io/.
// Clarity direction (spec 3a): dark mint-green canvas, two-column hero with
// a self-running product demo on the right, mono voice, big Space Grotesk
// numbers, full-width 3-cell stats bar at the bottom.
export async function WealthLanding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const signedIn = !!user;

  return (
    <main className="clarity-stage flex-1 font-sans text-white">
      <div className="mx-auto w-full max-w-[1320px] px-6 md:px-10 lg:px-[60px] pt-8 lg:pt-[34px] pb-10 lg:pb-[40px] min-h-screen flex flex-col gap-10 lg:gap-0">
        {/* NAV */}
        <nav className="flex items-center justify-between mb-8 lg:mb-[70px]">
          <span className="inline-flex items-center gap-[9px] border border-white/[0.12] rounded-full px-[15px] py-[8px]">
            <span className="w-[7px] h-[7px] rounded-full bg-[#00E5A0] clarity-pulseg" />
            <span className="font-mono text-[13px] text-[#e6e7ea]">
              Wealth · v1
            </span>
          </span>
          <div className="flex items-center gap-6 lg:gap-[34px] font-mono text-[13px] lg:text-[14px]">
            <span className="text-white">Home</span>
            <a
              href="https://github.com/marblemapo/marbs-v1"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#8a8d92] hover:text-white transition-colors"
            >
              Docs
            </a>
            <Link
              href={signedIn ? "/dashboard" : "/login"}
              className="text-[#8a8d92] hover:text-white transition-colors"
            >
              {signedIn ? "Dashboard" : "Sign in"}
            </Link>
          </div>
        </nav>

        {/* HERO — two-column on lg+, stacked below */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-10 items-center flex-1">
          {/* LEFT — copy + CTA + chips */}
          <div>
            <h1 className="font-display font-bold text-[40px] sm:text-[48px] lg:text-[56px] leading-[1.05] tracking-[-0.03em] m-0">
              <span className="text-white">Your net worth,</span>
              <br />
              <span className="text-[#6FE0B8]">private by default.</span>
            </h1>
            <p className="font-mono text-[14px] lg:text-[16px] text-[#8a8d92] leading-[1.6] mt-[26px] mb-[36px] lg:mb-[40px] max-w-[440px]">
              <span className="text-[#00E5A0]">//</span> self-custody your
              numbers. stocks, crypto, cash. no bank logins, no plaid.
            </p>
            <div className="flex items-center gap-5 mb-[40px] lg:mb-[52px]">
              <Link
                href={signedIn ? "/dashboard" : "/login"}
                className="clarity-cta"
              >
                {signedIn ? "Enter vault" : "Sign in"}
              </Link>
              <span className="font-mono text-[13px] lg:text-[14px] text-[#8a8d92]">
                {signedIn
                  ? `signed in as ${user!.email}`
                  : "Magic link · no password"}
              </span>
            </div>
            <div className="flex flex-wrap gap-[10px]">
              <span className="clarity-chip">end-to-end encrypted</span>
              <span className="clarity-chip">no Plaid</span>
              <span className="clarity-chip">open source</span>
            </div>
          </div>

          {/* RIGHT — self-running demo */}
          <div className="relative h-[360px] sm:h-[420px] lg:h-[480px]">
            <LandingDemo />
          </div>
        </div>

        {/* STATS ROW — full-width 3-cell bar */}
        <div
          className="mt-auto lg:mt-[40px] grid grid-cols-1 sm:grid-cols-3 rounded-[18px] overflow-hidden border border-white/[0.07]"
          style={{ background: "rgba(10,16,13,0.5)" }}
        >
          <StatCell
            label="Net worth"
            value="$2,184,729.84"
            cta={signedIn ? null : "Add your first asset →"}
            href="/login"
          />
          <StatCell
            label="Today"
            value="+$18,429.52"
            valueClassName="text-[#00E5A0]"
            cta={signedIn ? null : "See live movement →"}
            href="/login"
            withBorder
          />
          <StatCell
            label="Assets"
            value="12"
            cta={signedIn ? null : "Start tracking →"}
            href="/login"
          />
        </div>
      </div>
    </main>
  );
}

function StatCell({
  label,
  value,
  valueClassName = "text-white",
  cta,
  href,
  withBorder = false,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  cta: string | null;
  href: string;
  withBorder?: boolean;
}) {
  return (
    <div
      className={`px-[22px] py-[20px] lg:px-[26px] lg:py-[22px] ${
        withBorder
          ? "sm:border-l sm:border-r sm:border-white/[0.07] border-t sm:border-t-0 border-white/[0.07]"
          : "border-t sm:border-t-0 border-white/[0.07] first:border-t-0"
      }`}
    >
      <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-[#7d8085] mb-[10px]">
        {label}
      </div>
      <div
        className={`font-display font-bold text-[22px] lg:text-[26px] tabular-nums ${valueClassName}`}
      >
        {value}
      </div>
      {cta && (
        <Link
          href={href}
          className="inline-block font-mono text-[12px] text-[#00E5A0] mt-[8px] hover:opacity-80 transition-opacity"
        >
          {cta}
        </Link>
      )}
    </div>
  );
}
