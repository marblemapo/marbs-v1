"use client";

import { useState } from "react";
import { ConnectWalletDialog } from "@/components/connect-wallet-dialog";

/**
 * Dashboard empty-state. Two paths side-by-side — the manual onboarding flow
 * (primary, matches the happy path for new users), and the wallet auto-sync
 * (secondary, prominent enough that crypto-first users see it immediately).
 */
export function EmptyHoldingsCard() {
  const [walletOpen, setWalletOpen] = useState(false);

  return (
    <>
      <div className="f3-card p-8 flex flex-col items-center gap-5 text-center">
        <div className="flex flex-col gap-1">
          <div className="font-sans text-lg font-bold">No holdings yet</div>
          <div className="text-sm text-text-secondary max-w-[420px]">
            Add everything in one pass — stocks, crypto, cash — and see your
            net worth in about three minutes.
          </div>
        </div>
        <a href="/onboarding" className="f3-cta">
          Log my holdings →
        </a>

        <div className="w-full max-w-[420px] flex items-center gap-3 pt-2">
          <div className="flex-1 h-px bg-border" />
          <span className="font-plex text-[10px] text-text-muted uppercase tracking-wider">
            or
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button
          type="button"
          onClick={() => setWalletOpen(true)}
          className="w-full max-w-[420px] flex flex-col items-start gap-2 p-4 rounded-lg bg-surface border border-border hover:border-gold/40 transition-colors text-left"
        >
          <div className="flex items-center justify-between w-full gap-3">
            <div className="text-sm font-semibold text-foreground">
              Auto-sync from a wallet
            </div>
            <span className="text-gold text-base shrink-0">→</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {["ETH", "Base", "ARB", "OP", "Polygon", "BNB"].map((c) => (
              <span
                key={c}
                className="inline-flex items-center h-5 px-1.5 rounded bg-gold-dim text-gold text-[10px] font-semibold uppercase tracking-wider"
              >
                {c}
              </span>
            ))}
          </div>
          <div className="text-xs text-text-muted">
            Paste an EVM address or ENS. Read-only — we never spend.
          </div>
        </button>

        <div className="font-plex text-xs text-text-muted">
          Prefer one at a time? Use the{" "}
          <span className="text-[#7FFFD4] font-medium">+ Add asset</span>{" "}
          button above.
        </div>
      </div>

      <ConnectWalletDialog open={walletOpen} onOpenChange={setWalletOpen} />
    </>
  );
}
