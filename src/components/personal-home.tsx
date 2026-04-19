import Link from "next/link";
import Image from "next/image";
import { SubscribeForm } from "@/components/subscribe-form";
import { getAllPosts } from "@/lib/notebook";

const creating = [
  {
    name: "Wealth",
    href: "https://wealth.marbs.io",
    blurb: "Privacy-first net-worth tracker. Live prices across stocks, crypto, and cash.",
  },
];

const experience = [
  { company: "Crypto.com", role: "Senior PM — Prediction Market & Derivatives", period: "2024 — Now" },
  { company: "Binance.US", role: "Technical Project Manager, Product", period: "2023 — 2024" },
  { company: "HSBC Global Private Banking", role: "Scrum Master / TPM — Online Trading", period: "2022 — 2023" },
  { company: "Capgemini Invent", role: "Management Consultant, Financial Services", period: "2021 — 2022" },
  { company: "HSBC — PayMe", role: "AVP, Global Liquidity & Cash Management", period: "2019 — 2021" },
];

export function PersonalHome() {
  const recentPosts = getAllPosts().slice(0, 3);
  return (
    <div className="marbs-personal relative z-10 min-h-screen" style={{ background: "#f6f4ef", color: "#121212" }}>
      <div className="max-w-[680px] mx-auto px-6 sm:px-8">
        <header className="flex items-center justify-between pt-8 pb-16">
          <Link href="/" className="text-[15px] font-semibold tracking-tight">marbs.io</Link>
          <nav className="flex items-center gap-6 text-[14px] text-neutral-600">
            <a href="https://wealth.marbs.io" className="hover:text-black transition-colors">Wealth</a>
            <Link href="/notebook" className="hover:text-black transition-colors">Notebook</Link>
            <a href="mailto:marble.mpc@gmail.com" className="hover:text-black transition-colors">Contact</a>
          </nav>
        </header>

        <section className="text-center pb-20 sm:pb-28">
          <div className="flex justify-center mb-8">
            <div
              className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-full overflow-hidden"
              style={{ boxShadow: "0 20px 40px -20px rgba(0,0,0,0.35)" }}
            >
              <Image src="/marble.jpg" alt="Marble Ma" fill priority sizes="144px" className="object-cover" />
            </div>
          </div>
          <h1 className="font-display text-[32px] sm:text-[40px] leading-[1.15] tracking-tight font-semibold">
            Hi, I&apos;m Marble.
          </h1>
          <p className="mt-5 text-[17px] sm:text-[18px] leading-[1.6] text-neutral-700 max-w-[520px] mx-auto">
            Program manager, problem-solver, and builder based in Hong Kong. I help
            leadership teams ship ambitious products in FinTech, financial services,
            and digital assets — from Crypto.com and Binance.US to HSBC.
          </p>
          <div className="flex items-center justify-center gap-3 mt-8">
            <a
              href="mailto:marble.mpc@gmail.com"
              className="text-[14px] font-semibold px-5 py-2.5 rounded-full bg-black text-white hover:bg-neutral-800 transition-colors"
            >
              Get in touch
            </a>
            <a
              href="https://linkedin.com/in/marblempc"
              target="_blank"
              rel="noreferrer"
              className="text-[14px] font-medium px-5 py-2.5 rounded-full border border-neutral-300 hover:border-neutral-500 transition-colors"
            >
              LinkedIn
            </a>
          </div>
        </section>

        <section className="mb-20 sm:mb-28 rounded-2xl border border-neutral-200 bg-white p-7 sm:p-9">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-display text-[22px] font-semibold tracking-tight">
              <Link href="/notebook" className="hover:text-neutral-600 transition-colors">The Notebook</Link>
            </h2>
            <Link href="/notebook" className="text-[13px] text-neutral-500 hover:text-black transition-colors">
              All posts →
            </Link>
          </div>
          <p className="text-[15px] text-neutral-600 leading-relaxed mb-5">
            Occasional notes on building products in regulated markets, scaling crypto
            platforms, and the systems I use to stay organised. No spam, no fluff.
          </p>

          {recentPosts.length > 0 && (
            <ul className="mb-6 divide-y divide-neutral-200 border-y border-neutral-200">
              {recentPosts.map((p) => (
                <li key={p.slug}>
                  <Link href={`/notebook/${p.slug}`} className="block py-3 group">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="font-display text-[15px] font-semibold group-hover:text-neutral-600 transition-colors truncate">
                        {p.title}
                      </span>
                      <span className="text-[12px] font-mono text-neutral-500 shrink-0">{p.readingTime}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <SubscribeForm source="landing" />
        </section>

        <section id="work" className="mb-20 sm:mb-28">
          <h2 className="font-display text-[22px] font-semibold tracking-tight mb-6">Creating</h2>
          <ul className="space-y-3">
            {creating.map((p) => (
              <li key={p.name}>
                <a
                  href={p.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-5 p-5 rounded-2xl border border-neutral-200 bg-white hover:border-neutral-400 transition-colors group"
                >
                  <div
                    className="w-14 h-14 rounded-[14px] shrink-0 flex items-center justify-center"
                    style={{
                      background: "radial-gradient(120% 120% at 50% 30%, #1a1a1a 0%, #050505 70%)",
                      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
                    }}
                    aria-hidden
                  >
                    <span
                      className="font-display font-semibold text-[26px] leading-none"
                      style={{
                        color: "#7ef0c5",
                        textShadow: "0 0 10px rgba(126,240,197,0.35), 0 0 24px rgba(126,240,197,0.18)",
                      }}
                    >
                      W
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-semibold text-[17px]">{p.name}</span>
                      <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                        wealth.marbs.io
                      </span>
                    </div>
                    <p className="text-[14px] text-neutral-600 leading-snug mt-1">{p.blurb}</p>
                  </div>
                  <span className="text-neutral-400 group-hover:text-black transition-colors text-lg">→</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section id="about" className="mb-20 sm:mb-28">
          <h2 className="font-display text-[22px] font-semibold tracking-tight mb-6">Where I&apos;ve been</h2>
          <ul className="divide-y divide-neutral-200">
            {experience.map((e) => (
              <li key={e.company + e.period} className="py-4 flex items-baseline justify-between gap-6">
                <div className="min-w-0">
                  <div className="font-display font-semibold text-[16px] truncate">{e.company}</div>
                  <div className="text-[13px] text-neutral-600 truncate">{e.role}</div>
                </div>
                <div className="text-[12px] font-mono text-neutral-500 shrink-0">{e.period}</div>
              </li>
            ))}
          </ul>
        </section>

        <footer className="py-10 border-t border-neutral-200 flex items-center justify-between gap-4 text-[13px] text-neutral-600">
          <span>&copy; {new Date().getFullYear()} Marble Ma</span>
          <div className="flex items-center gap-5">
            <a href="mailto:marble.mpc@gmail.com" className="hover:text-black transition-colors">Email</a>
            <a href="https://linkedin.com/in/marblempc" target="_blank" rel="noreferrer" className="hover:text-black transition-colors">LinkedIn</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
