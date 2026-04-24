"use client";

/**
 * Variant E — Astral.
 * Aligned with wealth.marbs.io live design: aqua #7FFFD4 on near-black
 * #0A0A0A, font-plex uppercase labels, pill-badge pulse indicator,
 * "// comment"-style subtitle, hairline progress bar.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const AQUA = "#7FFFD4";
const BG = "#0A0A0A";
const BORDER = "rgba(255,255,255,0.08)";
const MUTED = "#8E8E93";

// Concentric orbits. Outermost settles first as assets value.
const ORBITS = [
  { r: 20, dur: 7.0, dir: 1 },
  { r: 30, dur: 10.0, dir: -1 },
  { r: 40, dur: 13.0, dir: 1 },
  { r: 50, dur: 17.0, dir: -1 },
];

export function AssemblyE({ total, done }: { total: number; done: number }) {
  const complete = total > 0 && done >= total;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setMounted(true);
    // Next frame → fade in.
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);
  useEffect(() => {
    // Fade out once the sequence completes.
    if (complete) setVisible(false);
  }, [complete]);
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
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

  const orbitsLocked =
    total > 0 ? Math.floor((done / total) * ORBITS.length) : 0;

  const overlay = (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: `radial-gradient(circle at 50% 40%, rgba(127,255,212,0.05), transparent 55%), ${BG}`,
        opacity: visible ? 1 : 0,
        transition: "opacity 500ms ease",
      }}
    >
      <style>{css}</style>

      {/* Top-right counter */}
      <div
        className="absolute top-8 right-8 font-plex text-[12px] font-medium tabular-nums tracking-wide"
        style={{ color: MUTED }}
      >
        {done} / {total}
      </div>

      {/* Centered stack */}
      <div className="relative flex flex-col items-center gap-8 px-6 max-w-[560px]">
        {/* Site-style pill badge */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border font-plex text-[12px] font-medium tracking-wide"
          style={{
            background: "rgba(255,255,255,0.04)",
            borderColor: BORDER,
            color: "#EBEBF5",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: complete ? "#00C805" : AQUA,
              boxShadow: `0 0 10px ${complete ? "#00C805" : AQUA}`,
              animation: complete ? "none" : "e-pulse 2s ease-in-out infinite",
            }}
          />
          <span>{complete ? "Wealth · assembled" : "Wealth · assembling"}</span>
        </div>

        {/* Orbit system — enlarged */}
        <div className="relative w-[min(90vw,520px)] h-[min(90vw,520px)] flex items-center justify-center">
          <svg
            viewBox="0 0 120 120"
            className="absolute inset-0 w-full h-full overflow-visible"
            aria-hidden
          >
            {ORBITS.map((orbit, i) => {
              const locked = i >= ORBITS.length - orbitsLocked;
              const lockAngle = -Math.PI / 2 + i * 0.9;
              const lockX = 60 + orbit.r * Math.cos(lockAngle);
              const lockY = 60 + orbit.r * Math.sin(lockAngle);
              return (
                <g key={i}>
                  <circle
                    cx="60"
                    cy="60"
                    r={orbit.r}
                    fill="none"
                    stroke={locked ? AQUA : "rgba(255,255,255,0.12)"}
                    strokeOpacity={locked ? 0.45 : 1}
                    strokeWidth="0.25"
                    strokeDasharray={locked ? "0" : "0.8 1.2"}
                    style={{ transition: "stroke 0.6s ease, stroke-opacity 0.6s ease" }}
                  />
                  <g
                    style={{
                      transformOrigin: "60px 60px",
                      animation: locked
                        ? "none"
                        : `e-spin-${orbit.dir === 1 ? "cw" : "ccw"} ${orbit.dur}s linear infinite`,
                    }}
                  >
                    <circle
                      cx={locked ? lockX : 60 + orbit.r}
                      cy={locked ? lockY : 60}
                      r={locked ? 1.8 : 1.4}
                      fill={locked ? AQUA : "#EBEBF5"}
                      style={{
                        filter: locked
                          ? `drop-shadow(0 0 3px ${AQUA})`
                          : "none",
                        transition: "r 0.5s ease, fill 0.5s ease",
                      }}
                    />
                  </g>
                </g>
              );
            })}
          </svg>

          {/* Central W core */}
          <div
            aria-hidden
            className="relative z-10 w-[88px] h-[88px] rounded-full flex items-center justify-center"
            style={{
              background: AQUA,
              boxShadow: `0 0 32px rgba(127,255,212,0.55), 0 0 80px rgba(127,255,212,0.18)`,
              animation: "e-core 3.4s ease-in-out infinite",
            }}
          >
            <span
              className="font-sans text-[32px] font-bold leading-none tracking-[-0.03em]"
              style={{ color: BG }}
            >
              W
            </span>
          </div>
        </div>

        {/* Hero line — mirrors site h1 pattern */}
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 className="font-sans font-bold text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.03em]">
            {complete ? (
              <>
                Net worth,
                <br />
                <span style={{ color: AQUA }}>assembled.</span>
              </>
            ) : (
              <>
                Assembling your net worth,
                <br />
                <span style={{ color: AQUA }}>privately.</span>
              </>
            )}
          </h2>
          <p
            className="font-plex text-[13px] leading-relaxed max-w-[380px]"
            style={{ color: MUTED }}
          >
            {complete
              ? "// every holding valued. nothing left to settle."
              : "// valuing every holding. no bank logins, no plaid."}
          </p>
        </div>

        {/* Subtle hairline progress */}
        <div className="flex flex-col items-center gap-2 w-full max-w-[280px]">
          <div
            className="relative w-full h-[2px] overflow-hidden rounded-full"
            style={{ background: "rgba(255,255,255,0.06)" }}
            aria-hidden
          >
            <div
              className="h-full"
              style={{
                width: `${pct}%`,
                background: AQUA,
                boxShadow: `0 0 6px ${AQUA}`,
                transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)",
              }}
            />
          </div>
          <span
            className="font-plex text-[11px] font-medium tabular-nums tracking-[0.12em]"
            style={{ color: MUTED }}
          >
            {pct}%
          </span>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

const css = `
  @keyframes e-spin-cw  { to { transform: rotate(360deg);  } }
  @keyframes e-spin-ccw { to { transform: rotate(-360deg); } }
  @keyframes e-core {
    0%, 100% { transform: scale(1);    }
    50%      { transform: scale(1.05); }
  }
  @keyframes e-pulse {
    0%, 100% { opacity: 1;   }
    50%      { opacity: 0.5; }
  }
`;
