"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Props = {
  label: string;
  target: number;
  prefix?: string;
  decimals?: number;
  cta: string;
  href: string;
  positive?: boolean;
  emptyDisplay: string;
  mountDelay?: number;
};

function formatWith(value: number, prefix: string, decimals: number) {
  const rounded = value.toFixed(decimals);
  const [intPart, decPart] = rounded.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${prefix}${withCommas}${decPart ? "." + decPart : ""}`;
}

export function StatCell({
  label,
  target,
  prefix = "",
  decimals = 0,
  cta,
  href,
  positive = false,
  emptyDisplay,
  mountDelay = 0,
}: Props) {
  const [display, setDisplay] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [mountActive, setMountActive] = useState(false);
  const rafRef = useRef<number | null>(null);

  // One-shot reveal on mount: count up and hold at the sample value
  useEffect(() => {
    const enter = window.setTimeout(() => setMountActive(true), mountDelay);
    return () => {
      window.clearTimeout(enter);
    };
  }, [mountDelay]);

  const active = hovering || mountActive;

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const from = display;
    const to = active ? target : 0;
    if (Math.abs(to - from) < 0.001) return;
    const start = performance.now();
    const duration = 700;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, target]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatted = formatWith(display, prefix, decimals);

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
      className="group relative bg-[#0A0A0A] p-5 flex flex-col gap-1.5 min-w-0 overflow-hidden transition-colors duration-200 hover:bg-[rgba(127,255,212,0.04)] focus:outline-none focus-visible:bg-[rgba(127,255,212,0.04)]"
    >
      <div className="font-plex text-[11px] text-text-muted uppercase tracking-[0.12em] font-medium">
        {label}
      </div>
      <div className="relative h-9">
        <div
          className={`font-plex text-xl sm:text-2xl font-semibold tabular-nums transition-opacity duration-150 ${
            positive ? "text-gain" : ""
          } ${active ? "opacity-0" : "opacity-100"}`}
        >
          {emptyDisplay}
        </div>
        <div
          className={`absolute inset-0 flex flex-col gap-0.5 transition-opacity duration-150 ${
            active ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={!active}
        >
          <div
            className={`font-plex text-xl sm:text-2xl font-semibold tabular-nums leading-none ${
              positive ? "text-gain" : "text-white"
            }`}
          >
            {formatted}
          </div>
          <div className="font-plex text-[11px] text-[#7FFFD4] tracking-wide mt-1">
            {cta} →
          </div>
        </div>
      </div>
    </Link>
  );
}
