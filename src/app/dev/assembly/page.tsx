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
import { AssemblyB2 } from "@/components/portfolio-assembly-variants/b2-implosion";
import { AssemblyB3 } from "@/components/portfolio-assembly-variants/b3-tumblers";
import { AssemblyB4 } from "@/components/portfolio-assembly-variants/b4-progress-rings";
import { AssemblyB5 } from "@/components/portfolio-assembly-variants/b5-polygon";
import { AssemblyB6 } from "@/components/portfolio-assembly-variants/b6-bloom";
import { AssemblyB7 } from "@/components/portfolio-assembly-variants/b7-scatter";
import { AssemblyB8 } from "@/components/portfolio-assembly-variants/b8-orbits";
import { AssemblyC } from "@/components/portfolio-assembly-variants/c-waterfall";
import { AssemblyD } from "@/components/portfolio-assembly-variants/d-rings";
import { AssemblyE } from "@/components/portfolio-assembly-variants/e-astral";
import { cn } from "@/lib/utils";

type Variant = "A" | "B" | "B2" | "B3" | "B4" | "B5" | "B6" | "B7" | "B8" | "C" | "D" | "E";

const VARIANTS: { id: Variant; name: string; tag: string }[] = [
  { id: "A", name: "Quiet", tag: "Minimalist typography. Maximum negative space." },
  { id: "B", name: "Vault", tag: "Ceremonial. Rings pulse outward from a central core." },
  { id: "B2", name: "Vault · Implosion", tag: "Rings contract inward to the core — assembling, not broadcasting." },
  { id: "B3", name: "Vault · Tumblers", tag: "Concentric arcs rotate at different speeds. Locks still on complete." },
  { id: "B4", name: "Vault · Progress rings", tag: "One ring materializes and locks per asset completed." },
  { id: "B5", name: "Vault · Polygon", tag: "Hexagonal rings pulse outward — mechanical, not spiritual." },
  { id: "B6", name: "Vault · Bloom", tag: "Subtle backdrop. Core wedges rotate open like petals at 100%." },
  { id: "B7", name: "Vault · Scatter", tag: "Fragments fly home to the core as progress advances. Assembly made literal." },
  { id: "B8", name: "Vault · Constellation", tag: "Dots circle the core; each ring settles in place as an asset is valued." },
  { id: "C", name: "Waterfall", tag: "Trading terminal. Columns of numbers stream past." },
  { id: "D", name: "Portfolio rings", tag: "Data-driven. One ring per asset fills as it settles." },
  { id: "E", name: "Astral", tag: "Aqua orbits + W core, bracketed progress bar, '// comment' subtitle. Matches live wealth.marbs.io." },
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
      {active === "B2" && <AssemblyB2 total={total} done={done} />}
      {active === "B3" && <AssemblyB3 total={total} done={done} />}
      {active === "B4" && <AssemblyB4 total={total} done={done} />}
      {active === "B5" && <AssemblyB5 total={total} done={done} />}
      {active === "B6" && <AssemblyB6 total={total} done={done} />}
      {active === "B7" && <AssemblyB7 total={total} done={done} />}
      {active === "B8" && <AssemblyB8 total={total} done={done} />}
      {active === "C" && <AssemblyC total={total} done={done} />}
      {active === "D" && <AssemblyD total={total} done={done} />}
      {active === "E" && <AssemblyE total={total} done={done} />}
    </main>
  );
}
