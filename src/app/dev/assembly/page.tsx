"use client";

/**
 * Local preview gallery for the onboarding "portfolio assembly" overlay.
 *
 *   pnpm dev  →  http://localhost:3000/dev/assembly
 *
 * Four variants (A/B/C/D) + controls for `total` and `done` so you can
 * scrub through the progress arc without having to trigger the real
 * onboarding save each time. Dev-only — not linked from anywhere.
 */

import { useEffect, useRef, useState } from "react";
import { AssemblyA } from "@/components/portfolio-assembly-variants/a-quiet";
import { AssemblyB } from "@/components/portfolio-assembly-variants/b-vault";
import { AssemblyC } from "@/components/portfolio-assembly-variants/c-waterfall";
import { AssemblyD } from "@/components/portfolio-assembly-variants/d-rings";
import { cn } from "@/lib/utils";

type Variant = "A" | "B" | "C" | "D";

const VARIANTS: { id: Variant; name: string; tag: string }[] = [
  { id: "A", name: "Quiet", tag: "Minimalist typography. Maximum negative space." },
  { id: "B", name: "Vault", tag: "Ceremonial. Rings pulse outward from a central core." },
  { id: "C", name: "Waterfall", tag: "Trading terminal. Columns of numbers stream past." },
  { id: "D", name: "Portfolio rings", tag: "Data-driven. One ring per asset fills as it settles." },
];

export default function AssemblyPreviewPage() {
  const [active, setActive] = useState<Variant | null>(null);
  const [total, setTotal] = useState(5);
  const [done, setDone] = useState(0);
  const [autoRun, setAutoRun] = useState(false);
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-run progress ticker for demos.
  useEffect(() => {
    if (!autoRun) {
      if (autoRef.current) clearTimeout(autoRef.current);
      return;
    }
    if (done >= total) {
      // Held on "complete" for a beat, then close.
      autoRef.current = setTimeout(() => {
        setAutoRun(false);
        setActive(null);
        setDone(0);
      }, 1500);
      return;
    }
    autoRef.current = setTimeout(() => setDone((d) => d + 1), 700);
    return () => {
      if (autoRef.current) clearTimeout(autoRef.current);
    };
  }, [autoRun, done, total]);

  function runVariant(id: Variant) {
    setActive(id);
    setDone(0);
    setAutoRun(true);
  }

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-foreground p-8 sm:p-14">
      <div className="max-w-[880px] mx-auto flex flex-col gap-12">
        <header className="flex flex-col gap-3">
          <span className="font-plex text-[11px] tracking-[0.3em] uppercase text-text-muted">
            Dev preview · portfolio assembly
          </span>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">
            Onboarding overlay variants
          </h1>
          <p className="text-sm text-text-secondary max-w-[560px]">
            Tap a card to preview the full-screen takeover. Each variant shows
            a 5-asset sync at ~0.7s per tick, then closes. Use the controls at
            the bottom to scrub progress manually if you want to freeze a
            frame.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {VARIANTS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => runVariant(v.id)}
              className="group text-left flex flex-col gap-2 p-5 rounded-xl bg-surface border border-border hover:border-gold/40 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-plex text-[10px] tracking-[0.3em] uppercase text-text-muted">
                  Variant {v.id}
                </span>
                <span className="font-plex text-[10px] tracking-[0.2em] uppercase text-gold group-hover:translate-x-0.5 transition-transform">
                  Play →
                </span>
              </div>
              <div className="font-display text-xl font-bold">{v.name}</div>
              <div className="text-sm text-text-muted leading-relaxed">
                {v.tag}
              </div>
            </button>
          ))}
        </div>

        {/* Manual scrubber */}
        <div className="flex flex-col gap-4 p-5 rounded-xl bg-surface border border-border">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-plex text-[10px] tracking-[0.3em] uppercase text-text-muted">
              Manual mode
            </span>
            <div className="flex gap-1.5">
              {VARIANTS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setAutoRun(false);
                    setActive(v.id);
                  }}
                  className={cn(
                    "h-7 px-2 rounded-md text-xs font-semibold transition-colors",
                    active === v.id
                      ? "bg-gold text-primary-foreground"
                      : "bg-white/5 text-text-secondary hover:bg-white/10",
                  )}
                >
                  {v.id}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setAutoRun(false);
                setActive(null);
              }}
              className="h-7 px-3 rounded-md text-xs font-semibold bg-loss/20 text-loss hover:bg-loss/30 transition-colors"
            >
              Close
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-plex text-[11px] uppercase tracking-wider text-text-muted flex items-center justify-between">
              <span>Total assets</span>
              <span className="tabular-nums text-foreground">{total}</span>
            </label>
            <input
              type="range"
              min={1}
              max={12}
              value={total}
              onChange={(e) => setTotal(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-plex text-[11px] uppercase tracking-wider text-text-muted flex items-center justify-between">
              <span>Done</span>
              <span className="tabular-nums text-foreground">{done}</span>
            </label>
            <input
              type="range"
              min={0}
              max={total}
              value={Math.min(done, total)}
              onChange={(e) => setDone(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        <div className="text-xs text-text-muted">
          Dev-only page. Not linked from anywhere. Deleted before production.
        </div>
      </div>

      {active === "A" && <AssemblyA total={total} done={done} />}
      {active === "B" && <AssemblyB total={total} done={done} />}
      {active === "C" && <AssemblyC total={total} done={done} />}
      {active === "D" && <AssemblyD total={total} done={done} />}
    </main>
  );
}
