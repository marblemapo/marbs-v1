"use client";

/**
 * Onboarding "portfolio assembly" takeover.
 *
 * Full-viewport cinematic overlay. Body scroll is locked while mounted so
 * the user can't scroll past it — the whole screen is hijacked.
 *
 * Layering (back → front):
 *   1. Dark wash + subtle aqua radial
 *   2. Soft grid pattern (terminal vibe)
 *   3. Horizontal scan line sweeping top-to-bottom (like a radar refresh)
 *   4. Constellation — SVG web of data nodes rotating slowly, with
 *      connecting hairlines. Node count adapts to sync progress.
 *   5. Currency-symbol orbs floating around the middle ($ € £ ¥ ₩ ₿)
 *   6. Typed headline with blinking aqua caret
 *   7. Scrolling ticker tape
 *   8. Hairline progress + N / M
 *
 * All CSS keyframes + inline SVG. No animation library.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const CURRENCY_GLYPHS = ["$", "€", "£", "¥", "₩", "₿"] as const;
const SCAN_DURATION_MS = 3600;

export function PortfolioAssembly({
  total,
  done,
}: {
  total: number;
  done: number;
}) {
  const complete = total > 0 && done >= total;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const message = complete ? "Net worth assembled." : "Gathering your net worth";
  const typed = useTypedText(message);

  // Portal guard — `fixed inset-0` is broken by any transformed / filtered
  // ancestor (the `fixed` becomes relative to that parent instead of the
  // viewport). Mounting straight to <body> bypasses every wrapper so the
  // overlay is guaranteed to cover the whole screen.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll while the overlay is mounted so the "takeover" is real.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    // Compensate for the scrollbar disappearing so layout doesn't shift.
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, []);

  if (!mounted) return null;

  const overlay = (
    <div
      className="fixed inset-0 z-[100] overflow-hidden flex flex-col items-center justify-center px-6"
      style={{
        background:
          "radial-gradient(ellipse 70% 50% at 50% 45%, rgba(127,255,212,0.08), transparent 70%), rgba(8,10,10,0.96)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      <style>{css}</style>

      {/* L2: subtle grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(127,255,212,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(127,255,212,0.4) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse 70% 80% at 50% 50%, black, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 80% at 50% 50%, black, transparent 75%)",
        }}
      />

      {/* L3: horizontal scan line */}
      <div
        aria-hidden
        className="absolute inset-x-0 h-[2px] pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(127,255,212,0.6), transparent)",
          boxShadow: "0 0 20px rgba(127,255,212,0.5)",
          animation: `pa-scan ${SCAN_DURATION_MS}ms ease-in-out infinite`,
        }}
      />

      {/* L4: constellation */}
      <svg
        aria-hidden
        viewBox="-200 -200 400 400"
        className="absolute w-[min(88vw,640px)] h-[min(88vw,640px)] pointer-events-none"
        style={{ filter: "drop-shadow(0 0 12px rgba(127,255,212,0.15))" }}
      >
        <defs>
          <linearGradient id="pa-link" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(127,255,212,0)" />
            <stop offset="50%" stopColor="rgba(127,255,212,0.5)" />
            <stop offset="100%" stopColor="rgba(127,255,212,0)" />
          </linearGradient>
        </defs>
        <g style={{ animation: "pa-spin-slow 60s linear infinite" }}>
          <ConstellationLines />
          <ConstellationNodes />
        </g>
      </svg>

      {/* L5: orbiting currency symbols */}
      <div
        aria-hidden
        className="absolute w-[min(96vw,760px)] h-[min(96vw,760px)] pointer-events-none select-none"
        style={{ animation: "pa-spin-slow 80s linear infinite reverse" }}
      >
        {CURRENCY_GLYPHS.map((glyph, i) => {
          const angle = (i / CURRENCY_GLYPHS.length) * 360;
          return (
            <span
              key={glyph}
              className="absolute left-1/2 top-1/2 font-display text-text-muted/40 text-xl sm:text-2xl tabular-nums"
              style={{
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-44%) rotate(${-angle}deg)`,
                animation: `pa-float ${4 + (i % 3)}s ease-in-out ${i * 0.3}s infinite`,
              }}
            >
              {glyph}
            </span>
          );
        })}
      </div>

      {/* L6: eyebrow + headline */}
      <div
        className="relative z-10 mb-8 font-plex text-[11px] tracking-[0.3em] uppercase text-text-muted flex items-center gap-2"
        style={{ animation: "pa-fade 600ms ease-out 100ms backwards" }}
      >
        <span
          aria-hidden
          className="inline-block w-1.5 h-1.5 rounded-full bg-[#7FFFD4]"
          style={{
            boxShadow: "0 0 10px #7FFFD4",
            animation: "pa-pulse 1.6s ease-in-out infinite",
          }}
        />
        <span>{complete ? "Ready" : "Synchronizing"}</span>
        <span className="text-text-muted/40">·</span>
        <span className="tabular-nums">{pct.toString().padStart(2, "0")}%</span>
      </div>

      <h1
        className={cn(
          "relative z-10 font-display font-bold tracking-[-0.03em] text-center leading-[1.05]",
          "text-[40px] sm:text-[56px] md:text-[72px] lg:text-[88px]",
          "max-w-[900px]",
        )}
      >
        {typed}
        <span
          aria-hidden
          className="inline-block w-[0.08em] h-[0.8em] ml-1 align-baseline bg-[#7FFFD4]"
          style={{
            animation: "pa-caret 800ms steps(2, start) infinite",
            transform: "translateY(0.08em)",
            boxShadow: "0 0 8px rgba(127,255,212,0.5)",
          }}
        />
      </h1>

      {/* L7: ticker tape */}
      <div
        className="relative z-10 mt-12 w-full max-w-[520px] overflow-hidden select-none"
        style={{
          maskImage:
            "linear-gradient(90deg, transparent, black 20%, black 80%, transparent)",
          WebkitMaskImage:
            "linear-gradient(90deg, transparent, black 20%, black 80%, transparent)",
        }}
      >
        <div
          className="flex gap-10 font-plex text-[11px] tracking-[0.2em] uppercase text-text-muted whitespace-nowrap"
          style={{ animation: "pa-marquee 22s linear infinite" }}
        >
          {Array.from({ length: 2 }).flatMap((_, copy) =>
            [
              "STOCKS",
              "·",
              "CRYPTO",
              "·",
              "CASH",
              "·",
              "FX",
              "·",
              "ON-CHAIN",
              "·",
              "GLOBAL",
              "·",
            ].map((t, i) => (
              <span
                key={`${copy}-${i}`}
                className={t === "·" ? "text-text-muted/30" : ""}
              >
                {t}
              </span>
            )),
          )}
        </div>
      </div>

      {/* L8: hairline progress */}
      <div className="relative z-10 mt-12 w-full max-w-[360px] flex flex-col gap-2.5">
        <div className="relative h-px bg-white/[0.08] overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-[#7FFFD4] transition-[width] duration-[600ms] ease-out"
            style={{
              width: `${pct}%`,
              boxShadow: "0 0 12px rgba(127,255,212,0.6)",
            }}
          />
        </div>
        <div className="flex items-center justify-between font-plex text-[10px] uppercase tracking-[0.2em] text-text-muted tabular-nums">
          <span>{complete ? "Complete" : "In progress"}</span>
          <span>
            {done} / {total}
          </span>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

/**
 * Six-node web (pentagon + center), connecting lines faded at the ends.
 * Pure visual — doesn't reflect real state. The point is to feel like a
 * data graph, not be one.
 */
function ConstellationNodes() {
  const nodes = nodePositions();
  return (
    <>
      {nodes.map(([x, y], i) => (
        <g key={i}>
          <circle
            cx={x}
            cy={y}
            r="3"
            fill="#7FFFD4"
            style={{
              animation: `pa-pulse 2.4s ease-in-out ${i * 0.35}s infinite`,
              filter: "drop-shadow(0 0 6px #7FFFD4)",
            }}
          />
        </g>
      ))}
    </>
  );
}

function ConstellationLines() {
  const nodes = nodePositions();
  const center = nodes[0];
  return (
    <>
      {nodes.slice(1).map(([x, y], i) => (
        <line
          key={`c-${i}`}
          x1={center[0]}
          y1={center[1]}
          x2={x}
          y2={y}
          stroke="url(#pa-link)"
          strokeWidth="0.6"
        />
      ))}
      {nodes.slice(1).map(([x, y], i, arr) => {
        const next = arr[(i + 1) % arr.length];
        return (
          <line
            key={`r-${i}`}
            x1={x}
            y1={y}
            x2={next[0]}
            y2={next[1]}
            stroke="url(#pa-link)"
            strokeWidth="0.4"
          />
        );
      })}
    </>
  );
}

function nodePositions(): Array<[number, number]> {
  const positions: Array<[number, number]> = [[0, 0]];
  const ringRadius = 130;
  const ringCount = 5;
  for (let i = 0; i < ringCount; i++) {
    const angle = (i / ringCount) * Math.PI * 2 - Math.PI / 2;
    positions.push([
      Math.cos(angle) * ringRadius,
      Math.sin(angle) * ringRadius,
    ]);
  }
  return positions;
}

/**
 * Types the target text one character at a time. Resets when target changes
 * (e.g. "Gathering…" → "Net worth assembled.").
 */
function useTypedText(target: string) {
  const [shown, setShown] = useState("");

  useEffect(() => {
    setShown("");
    let i = 0;
    const interval = window.setInterval(() => {
      i += 1;
      setShown(target.slice(0, i));
      if (i >= target.length) window.clearInterval(interval);
    }, 42);
    return () => window.clearInterval(interval);
  }, [target]);

  return shown;
}

const css = `
  @keyframes pa-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.6; transform: scale(1.4); }
  }
  @keyframes pa-caret {
    0%, 49%   { opacity: 1; }
    50%, 100% { opacity: 0; }
  }
  @keyframes pa-fade {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pa-marquee {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }
  @keyframes pa-spin-slow {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes pa-scan {
    0%   { transform: translateY(-100vh); opacity: 0; }
    10%  { opacity: 1; }
    90%  { opacity: 1; }
    100% { transform: translateY(100vh); opacity: 0; }
  }
  @keyframes pa-float {
    0%, 100% { opacity: 0.35; }
    50%      { opacity: 0.85; }
  }
`;
