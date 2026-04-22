"use client";

import { useState } from "react";
import { ConnectWalletDialog } from "@/components/connect-wallet-dialog";

/**
 * Dashboard empty state. Clear primary path (manual logging) + a subtle
 * inline hint for crypto-wallet users. The old design gave both options
 * equal visual weight with boxed cards and an "OR" — too much friction
 * for a user who just wants to start.
 */
export function EmptyHoldingsCard() {
  const [walletOpen, setWalletOpen] = useState(false);

  return (
    <>
      <div className="f3-card p-8 flex flex-col items-center gap-5 text-center">
        <div className="flex flex-col gap-1">
          <div className="font-sans text-lg font-bold">No holdings yet</div>
          <div className="text-sm text-text-secondary max-w-[420px]">
            Add everything in one pass — stocks, crypto, cash. About three
            minutes.
          </div>
        </div>

        <a href="/onboarding" className="f3-cta">
          Log my holdings →
        </a>

        <button
          type="button"
          onClick={() => setWalletOpen(true)}
          className="font-plex text-xs text-text-muted hover:text-gold transition-colors mt-1"
        >
          Have a crypto wallet? Connect to auto-sync across 6 EVM chains →
        </button>
      </div>

      <ConnectWalletDialog open={walletOpen} onOpenChange={setWalletOpen} />
    </>
  );
}
