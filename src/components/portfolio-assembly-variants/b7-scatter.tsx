"use client";

/**
 * Variant B7 — Scatter assemble.
 * Fragments scattered across the overlay fly home to the core as
 * progress advances. The $ glyph reconstructs itself.
 * Inspired by spasoje.dev's scattered-letters-to-assembly pattern.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const SHARD_COUNT = 18;

// Cheap seeded pseudo-random so shards stay stable between renders.
function seededRand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function AssemblyB7({ total, done }: { total: number; done: number }) {
  const complete = total > 0 && done >= total;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const progress = total > 0 ? Math.min(done / total, 1) : 0;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const shards = useMemo(
    () =>
      Array.from({ length: SHARD_COUNT }, (_, i) => {
        // Polar scatter, stable per-index.
        const angle = seededRand(i + 1) * Math.PI * 2;
        const radius = 30 + seededRand(i + 100) * 35; // 30–65% of overlay
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const rot = (seededRand(i + 200) - 0.5) * 180;
        const size = 6 + seededRand(i + 300) * 10;
        const delay = seededRand(i + 400) * 0.25;
        return { x, y, rot, size, delay };
      }),
    [],
  );

  if (!mounted) return null;

  const overlay = (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{
        background:
          "radial-gradient(circle at 50% 50%, rgba(127,255,212,0.08), transparent 65%), rgba(8,10,10,0.96)",
      }}
    >
      <div className="relative w-[min(90vw,560px)] h-[min(90vw,560px)] flex items-center justify-center">
        {/* Shards */}
        {shards.map((s, i) => {
          // progress 0 → scattered, 1 → at origin.
          const tx = s.x * (1 - progress);
          const ty = s.y * (1 - progress);
          const rot = s.rot * (1 - progress);
          const opacity = 0.45 + progress * 0.55;
          return (
            <div
              key={i}
              aria-hidden
              className="absolute bg-[#7FFFD4]"
              style={{
                width: `${s.size}px`,
                height: `${s.size}px`,
                transform: `translate(${tx}%, ${ty}%) rotate(${rot}deg)`,
                opacity,
                transition: `transform 0.6s cubic-bezier(0.22,1,0.36,1) ${s.delay}s, opacity 0.5s ease ${s.delay}s`,
                boxShadow: complete
                  ? "0 0 8px rgba(127,255,212,0.6)"
                  : "0 0 4px rgba(127,255,212,0.3)",
              }}
            />
          );
        })}

        {/* Core — fades in as progress completes */}
        <div
          aria-hidden
          className="relative z-10 w-20 h-20 rounded-full bg-[#7FFFD4] flex items-center justify-center"
          style={{
            opacity: progress,
            transform: `scale(${0.6 + progress * 0.4})`,
            transition:
              "opacity 0.5s ease, transform 0.7s cubic-bezier(0.22,1,0.36,1)",
            boxShadow:
              "0 0 40px rgba(127,255,212,0.8), 0 0 80px rgba(127,255,212,0.3)",
          }}
        >
          <span className="font-display text-3xl font-bold text-black">W</span>
        </div>
      </div>

      <div className="absolute bottom-[14vh] flex flex-col items-center gap-4">
        <div className="font-display text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-center">
          {complete ? "Net worth assembled." : "Assembling your net worth…"}
        </div>
        <div className="flex items-center gap-3 font-plex text-[11px] uppercase tracking-[0.25em] text-text-muted tabular-nums">
          <span>{pct.toString().padStart(3, "0")}%</span>
          <span className="text-text-muted/40">·</span>
          <span>
            {done} / {total}
          </span>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
