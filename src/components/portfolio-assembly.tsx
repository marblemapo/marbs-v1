"use client";

/**
 * Onboarding "portfolio assembly" animation.
 *
 * Visual concept: three category arms — Stocks, Crypto, Cash — emit a stream
 * of particles that arc toward a central pulsing orb representing net worth.
 * Lives as a fixed overlay while the addAsset server actions fan out.
 *
 * Motion language matches the dashboard live pulse (aqua #7FFFD4 glow,
 * ~1.2s breathing cadence). No external animation library — pure CSS
 * keyframes inlined in-file.
 */

import { cn } from "@/lib/utils";

export function PortfolioAssembly({
  total,
  done,
}: {
  /** total assets being saved */
  total: number;
  /** how many of them have returned (success or fail doesn't matter here — we're just communicating progress) */
  done: number;
}) {
  const complete = total > 0 && done >= total;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background:
          "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(127,255,212,0.08), transparent 60%), rgba(10,10,10,0.92)",
        backdropFilter: "blur(10px)",
      }}
    >
      <style>{keyframes}</style>

      <div className="flex flex-col items-center gap-10">
        {/* Core canvas */}
        <div className="relative w-[280px] h-[280px]">
          {/* Orbit rings */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-full border border-white/[0.05]"
            style={{ animation: "pa-spin 24s linear infinite" }}
          />
          <div
            aria-hidden
            className="absolute inset-8 rounded-full border border-white/[0.05]"
            style={{ animation: "pa-spin 18s linear infinite reverse" }}
          />
          <div
            aria-hidden
            className="absolute inset-16 rounded-full border border-white/[0.05]"
            style={{ animation: "pa-spin 12s linear infinite" }}
          />

          {/* Central net-worth orb */}
          <div
            aria-hidden
            className={cn(
              "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
              "w-16 h-16 rounded-full",
              complete ? "bg-[#7FFFD4]" : "bg-[#7FFFD4]/80",
            )}
            style={{
              animation: "pa-core 1.6s ease-in-out infinite",
              boxShadow:
                "0 0 30px rgba(127,255,212,0.6), 0 0 60px rgba(127,255,212,0.3)",
            }}
          />
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-xs font-bold uppercase tracking-widest text-black/70"
          >
            $
          </div>

          {/* Three category arms + streaming particles */}
          <CategoryArm
            label="STOCKS"
            angle={-90}
            color="#7FFFD4"
            delay={0}
          />
          <CategoryArm
            label="CRYPTO"
            angle={30}
            color="#f5c518"
            delay={0.4}
          />
          <CategoryArm
            label="CASH"
            angle={150}
            color="#EBEBF5"
            delay={0.8}
          />
        </div>

        {/* Status */}
        <div className="flex flex-col items-center gap-3 max-w-[360px] text-center">
          <div className="font-display text-xl font-bold leading-tight tracking-tight">
            {complete ? "Net worth assembled" : "Gathering your net worth"}
          </div>

          {/* Progress bar */}
          <div className="w-full h-1 rounded-full bg-white/[0.08] overflow-hidden">
            <div
              className="h-full bg-[#7FFFD4] transition-all duration-500 ease-out"
              style={{
                width: `${pct}%`,
                boxShadow: "0 0 12px rgba(127,255,212,0.6)",
              }}
            />
          </div>

          <div className="font-plex text-[11px] text-text-muted uppercase tracking-wider tabular-nums">
            {done} of {total} assets synced
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A single category "arm" — label placed at a fixed angle on the outer ring,
 * with a particle that loops from the label inward to the core. Staggered
 * `delay` so the three arms don't fire in lockstep.
 */
function CategoryArm({
  label,
  angle,
  color,
  delay,
}: {
  label: string;
  angle: number; // degrees, 0 = right, -90 = top
  color: string;
  delay: number; // seconds
}) {
  const rad = (angle * Math.PI) / 180;
  const radius = 120;
  const x = Math.cos(rad) * radius;
  const y = Math.sin(rad) * radius;

  return (
    <>
      {/* Label chip at the outer position */}
      <div
        className="absolute left-1/2 top-1/2 font-plex text-[10px] uppercase tracking-widest font-semibold px-2 py-1 rounded-pill"
        style={{
          transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
          color,
          background: `${color}22`,
          border: `1px solid ${color}44`,
          animation: `pa-label 1.6s ease-in-out ${delay}s infinite`,
        }}
      >
        {label}
      </div>

      {/* Three staggered particles per arm so the stream feels continuous */}
      {[0, 0.6, 1.2].map((offset) => (
        <div
          key={offset}
          aria-hidden
          className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full"
          style={{
            background: color,
            boxShadow: `0 0 8px ${color}`,
            animation: `pa-particle-${Math.round(angle)} 1.8s linear ${delay + offset}s infinite`,
            // Each arm needs its own @keyframes because the end x/y coords
            // differ — we generate them inline below per unique angle.
          }}
        />
      ))}

      <style>{`
        @keyframes pa-particle-${Math.round(angle)} {
          0% {
            transform: translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(0.6);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.1);
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}

const keyframes = `
  @keyframes pa-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes pa-core {
    0%, 100% {
      transform: translate(-50%, -50%) scale(1);
      filter: brightness(1);
    }
    50% {
      transform: translate(-50%, -50%) scale(1.08);
      filter: brightness(1.15);
    }
  }
  @keyframes pa-label {
    0%, 100% { opacity: 0.75; }
    50%      { opacity: 1; }
  }
`;
