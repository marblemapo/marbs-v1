"use client";

import { useEffect, useState } from "react";

// Self-running product demo for the Clarity landing (spec 3a). Cycles three
// scenes on a horizontal carousel (Add asset → Net worth → Insights) every
// 4.2s, random-walks the demo numbers every 1.3s so the "live" scene feels
// alive. Chart line draws in via stroke-dashoffset — see .clarity-draw.

const SCENE_INTERVAL_MS = 4200;
const TICK_INTERVAL_MS = 1300;

const INITIAL = { net: 2184729.84, btc: 71204.5, aapl: 244.0 };

export function LandingDemo() {
  const [scene, setScene] = useState(0);
  const [v, setV] = useState(INITIAL);

  useEffect(() => {
    const id = setInterval(
      () => setScene((s) => (s + 1) % 3),
      SCENE_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setV((prev) => ({
        net: prev.net + (Math.random() - 0.5) * 440,
        btc: prev.btc + (Math.random() - 0.5) * 280,
        aapl: prev.aapl + (Math.random() - 0.5) * 6,
      }));
    }, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Compute each scene's absolute-positioned transform relative to the current
  // one. diff=0 is on-screen; diff=1 is queued right; diff=2 is off-screen left.
  // The "prev" scene slides invisibly (opacity 0) so we don't jump.
  const scenePos = (i: number): React.CSSProperties => {
    const diff = (i - scene + 3) % 3;
    const x = diff === 0 ? "0%" : diff === 1 ? "104%" : "-104%";
    const opacity = diff === 0 ? 1 : 0;
    return {
      position: "absolute",
      inset: 0,
      padding: "22px",
      transform: `translateX(${x})`,
      opacity,
      transition:
        "transform 0.8s cubic-bezier(0.6,0,0.25,1), opacity 0.6s ease",
    };
  };

  const netWhole = Math.floor(v.net).toLocaleString("en-US");
  const netCents =
    "." +
    Math.floor((v.net - Math.floor(v.net)) * 100)
      .toString()
      .padStart(2, "0");
  const btcStr = "$" + Math.round(v.btc).toLocaleString("en-US");
  const aaplStr = "$" + v.aapl.toFixed(2);

  return (
    <div className="relative w-full h-full flex items-center">
      {/* mint bloom behind the frame */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          inset: "-8% -5%",
          background:
            "radial-gradient(closest-side, rgba(0,229,160,0.22), transparent 72%)",
          filter: "blur(16px)",
        }}
      />
      {/* frameless rounded screen */}
      <div
        className="relative w-full rounded-[22px] overflow-hidden clarity-floaty"
        style={{
          background:
            "radial-gradient(90% 60% at 50% -8%, rgba(0,229,160,0.10), transparent 60%), #0B0C0E",
          boxShadow:
            "0 50px 90px -30px rgba(0,0,0,0.85), inset 0 0 0 1px rgba(255,255,255,0.05)",
        }}
      >
        <div className="relative" style={{ aspectRatio: "4 / 3" }}>
          <SceneA style={scenePos(0)} />
          <SceneB
            style={scenePos(1)}
            active={scene === 1}
            netWhole={netWhole}
            netCents={netCents}
            btc={btcStr}
            aapl={aaplStr}
          />
          <SceneC style={scenePos(2)} />
        </div>
      </div>
    </div>
  );
}

// ── SCENE A · Add asset ─────────────────────────────────────────

function SceneA({ style }: { style: React.CSSProperties }) {
  return (
    <div style={style}>
      <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-[#8a8d92] mb-4">
        Add asset
      </div>
      <div className="flex gap-1.5 bg-white/[0.05] rounded-xl p-1 mb-3.5">
        <span className="flex-1 text-center text-[11px] font-semibold text-[#052018] bg-[#00E5A0] rounded-lg py-2">
          Stock
        </span>
        <span className="flex-1 text-center text-[11px] text-[#c3c5c9] py-2">
          Crypto
        </span>
        <span className="flex-1 text-center text-[11px] text-[#c3c5c9] py-2">
          Cash
        </span>
        <span className="flex-1 text-center text-[11px] text-[#c3c5c9] py-2">
          Custom
        </span>
      </div>
      <div className="flex items-center gap-2.5 bg-white/[0.06] border border-[#00E5A0]/30 rounded-xl px-4 py-3 mb-3">
        <span className="text-[#8a8d92] text-[15px]">⌕</span>
        <span className="text-[#e6e7ea] text-sm">NVDA</span>
        <span className="w-[1.5px] h-[15px] bg-[#00E5A0] clarity-caret" />
      </div>
      <div
        className="flex items-center gap-3 px-1.5 py-3 rounded-xl clarity-rise"
        style={{
          background: "linear-gradient(90deg, rgba(0,229,160,0.10), transparent)",
        }}
      >
        <span
          className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center font-display font-bold text-[11px]"
          style={{ background: "#76b90022", color: "#a3e635" }}
        >
          NV
        </span>
        <span className="flex-1">
          <span className="block text-[13px] font-semibold text-white">
            NVIDIA Corp
          </span>
          <span className="block text-[11px] text-[#8a8d92] font-mono">
            NVDA · NASDAQ
          </span>
        </span>
        <span className="font-display font-bold text-white text-[13px]">
          $1,204
        </span>
      </div>
      <div className="mt-3.5 rounded-2xl bg-white/[0.05] border border-white/10 p-4 flex justify-between items-baseline clarity-rise-1">
        <span>
          <span className="block text-[11px] text-[#8a8d92] mb-1">Quantity</span>
          <span className="font-display font-bold text-2xl text-white">12</span>
        </span>
        <span className="text-right">
          <span className="block text-[11px] text-[#8a8d92] mb-1">≈ value</span>
          <span className="font-display font-bold text-xl text-[#00E5A0] tabular-nums">
            $14,448
          </span>
        </span>
      </div>
      <div
        className="mt-3.5 text-center font-display font-bold text-sm rounded-full py-3"
        style={{
          background: "#00E5A0",
          color: "#04170f",
          boxShadow: "0 10px 22px -8px rgba(0,229,160,0.55)",
        }}
      >
        Add to portfolio
      </div>
    </div>
  );
}

// ── SCENE B · Net worth (live-ticking) ──────────────────────────

function SceneB({
  style,
  active,
  netWhole,
  netCents,
  btc,
  aapl,
}: {
  style: React.CSSProperties;
  active: boolean;
  netWhole: string;
  netCents: string;
  btc: string;
  aapl: string;
}) {
  return (
    <div style={style} aria-hidden={!active}>
      <div className="flex justify-between items-center mb-3">
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00E5A0] clarity-pulseg" />
          <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-[#8a8d92]">
            Net worth · Live
          </span>
        </span>
        <span className="font-mono text-[10px] text-[#5a5d62]">HKD</span>
      </div>
      <div className="font-display font-bold text-[40px] text-white tracking-[-0.02em] tabular-nums leading-none">
        {netWhole}
        <span className="text-[#4a4d52] text-[22px]">{netCents}</span>
      </div>
      <div className="flex items-center gap-2 mt-2.5">
        <span className="inline-flex items-center gap-1.5 bg-[#00E5A0]/[0.14] text-[#00E5A0] font-display font-bold text-xs rounded-full px-2 py-0.5">
          ↑ $18,429.52
        </span>
        <span className="text-[#00E5A0] font-semibold text-xs">+0.85%</span>
      </div>
      <svg
        viewBox="0 0 620 150"
        width="100%"
        height="118"
        preserveAspectRatio="none"
        className="mt-3 block"
        style={{ overflow: "visible" }}
      >
        <defs>
          <linearGradient id="clarity-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#00E5A0" stopOpacity="0.24" />
            <stop offset="1" stopColor="#00E5A0" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,120 C60,110 100,72 160,80 C220,88 260,44 320,54 C380,64 420,24 480,34 C540,44 590,14 620,22 L620,150 L0,150 Z"
          fill="url(#clarity-chart-fill)"
        />
        <path
          d="M0,120 C60,110 100,72 160,80 C220,88 260,44 320,54 C380,64 420,24 480,34 C540,44 590,14 620,22"
          fill="none"
          stroke="#00E5A0"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="clarity-draw"
        />
        <circle cx="620" cy="22" r="4" fill="#00E5A0" />
        <circle cx="620" cy="22" r="9" fill="#00E5A0" opacity="0.25" />
      </svg>
      <div className="flex flex-col gap-0.5 mt-2">
        <div className="flex items-center gap-2.5 px-1 py-2">
          <span
            className="w-7 h-7 rounded-[9px] flex items-center justify-center font-mono font-semibold text-[9px] tracking-[-0.02em]"
            style={{ background: "#f7931a22", color: "#f7931a" }}
          >
            BTC
          </span>
          <span className="flex-1 text-xs font-semibold text-white">Bitcoin</span>
          <span className="font-display font-bold text-xs text-white tabular-nums">
            {btc}
          </span>
          <span className="font-display text-[11px] text-[#00E5A0] min-w-[40px] text-right">
            +2.1%
          </span>
        </div>
        <div className="flex items-center gap-2.5 px-1 py-2 border-t border-white/[0.06]">
          <span
            className="w-7 h-7 rounded-[9px] flex items-center justify-center font-mono font-semibold text-[8px] tracking-[-0.02em]"
            style={{ background: "#ffffff12", color: "#e6e7ea" }}
          >
            AAPL
          </span>
          <span className="flex-1 text-xs font-semibold text-white">Apple</span>
          <span className="font-display font-bold text-xs text-white tabular-nums">
            {aapl}
          </span>
          <span className="font-display text-[11px] text-[#FF5000] min-w-[40px] text-right">
            −0.6%
          </span>
        </div>
      </div>
    </div>
  );
}

// ── SCENE C · Insights ──────────────────────────────────────────

function SceneC({ style }: { style: React.CSSProperties }) {
  return (
    <div style={style}>
      <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-[#8a8d92] mb-3.5">
        Portfolio insights
      </div>
      <div className="flex justify-between items-baseline mb-2.5">
        <span className="font-mono text-[11px] text-[#7d8085]">Allocation</span>
        <span className="font-mono text-[10px] text-[#5a5d62]">
          4 classes · 5 assets
        </span>
      </div>
      <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5 mb-2.5">
        <div className="bg-[#00E5A0]" style={{ flex: 40 }} />
        <div className="bg-[#3aa0ff]" style={{ flex: 35 }} />
        <div className="bg-[#f5c518]" style={{ flex: 15 }} />
        <div className="bg-[#b07cff]" style={{ flex: 10 }} />
      </div>
      <div className="flex flex-wrap gap-x-3.5 gap-y-2.5 font-mono text-[10px] text-[#9aa39e] mb-4">
        <span>
          <span className="text-[#00E5A0]">●</span> Crypto 40%
        </span>
        <span>
          <span className="text-[#3aa0ff]">●</span> Stocks 35%
        </span>
        <span>
          <span className="text-[#f5c518]">●</span> Cash 15%
        </span>
        <span>
          <span className="text-[#b07cff]">●</span> ETFs 10%
        </span>
      </div>
      <div className="flex gap-2.5 mb-3">
        <div
          className="rounded-2xl p-3.5 clarity-rise"
          style={{
            flex: 1.4,
            background: "rgba(255,80,0,0.06)",
            border: "1px solid rgba(255,80,0,0.25)",
          }}
        >
          <div className="flex items-center justify-between mb-2.5">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF5000]" />
              <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-[#FF5000]">
                Concentration · High
              </span>
            </span>
            <span className="font-display font-bold text-[15px] text-white">
              78%
            </span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden bg-white/[0.06] mb-2">
            <div
              className="w-[78%]"
              style={{ background: "linear-gradient(90deg, #FF5000, #ff7a3d)" }}
            />
          </div>
          <div className="text-xs text-[#c3c5c9] leading-[1.45]">
            Stocks and crypto move together — most of your risk is one bet.
          </div>
        </div>
        <div
          className="rounded-2xl p-3.5 flex flex-col justify-center clarity-rise-1"
          style={{ flex: 1, background: "rgba(255,255,255,0.04)" }}
        >
          <div className="font-mono text-[10px] tracking-[0.1em] uppercase text-[#7d8085] mb-2">
            Diversification
          </div>
          <div className="font-display font-bold text-[26px] text-[#f5c518] leading-none">
            42
            <span className="text-sm text-[#5a5d62]">/100</span>
          </div>
          <div className="flex gap-0.5 mt-2.5">
            <span className="flex-1 h-1 rounded-sm bg-[#f5c518]" />
            <span className="flex-1 h-1 rounded-sm bg-[#f5c518]" />
            <span className="flex-1 h-1 rounded-sm bg-white/[0.1]" />
            <span className="flex-1 h-1 rounded-sm bg-white/[0.1]" />
            <span className="flex-1 h-1 rounded-sm bg-white/[0.1]" />
          </div>
        </div>
      </div>
      <div className="flex gap-2.5 clarity-rise-2">
        <div
          className="flex-1 rounded-xl px-3.5 py-3"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <div className="text-[10px] text-[#7d8085] mb-1.5">Invested</div>
          <div className="font-display font-bold text-base text-white tabular-nums">
            $212,530
          </div>
        </div>
        <div
          className="flex-1 rounded-xl px-3.5 py-3"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <div className="text-[10px] text-[#7d8085] mb-1.5">All-time gain</div>
          <div className="font-display font-bold text-base text-[#00E5A0] tabular-nums">
            +$72,382
          </div>
        </div>
        <div
          className="flex-1 rounded-xl px-3.5 py-3"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <div className="text-[10px] text-[#7d8085] mb-1.5">Top mover</div>
          <div className="font-display font-bold text-base text-[#00E5A0] tabular-nums">
            NVDA +4.2%
          </div>
        </div>
      </div>
    </div>
  );
}
