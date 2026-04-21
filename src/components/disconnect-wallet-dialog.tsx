"use client";

import { useState, useTransition } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { disconnectWallet } from "@/app/actions/wallets";

export function DisconnectWalletDialog({
  walletId,
  walletLabel,
  onClose,
}: {
  walletId: string | null;
  walletLabel: string | null;
  onClose: () => void;
}) {
  const [purge, setPurge] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const open = walletId != null;

  function handle() {
    if (!walletId) return;
    setError(null);
    startTransition(async () => {
      const res = await disconnectWallet(walletId, { keepAssets: !purge });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPurge(false);
      onClose();
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="f3-theme w-full sm:max-w-[440px] flex flex-col gap-0 p-0 border-l border-white/[0.08]"
      >
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="font-display text-2xl font-bold tracking-tight">
            Disconnect wallet
          </SheetTitle>
          <p className="text-sm text-text-secondary mt-2 leading-relaxed">
            {walletLabel
              ? `Disconnect "${walletLabel}" from marbs.`
              : "Disconnect this wallet from marbs."}{" "}
            By default we keep the most recent balances as frozen manual rows so
            your history stays intact.
          </p>
        </SheetHeader>

        <div className="flex flex-col flex-1 gap-5 px-6 pb-6">
          <label className="flex items-start gap-3 p-4 rounded-lg bg-surface border border-border cursor-pointer hover:bg-surface-hover transition-colors">
            <input
              type="checkbox"
              checked={purge}
              onChange={(e) => setPurge(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-loss"
            />
            <div className="flex flex-col gap-0.5">
              <div className="text-sm font-semibold">
                Also delete imported assets
              </div>
              <div className="text-xs text-text-muted leading-relaxed">
                Removes every token + snapshot that came from this wallet. Your
                manual entries are untouched. Can&apos;t be undone.
              </div>
            </div>
          </label>

          {error && (
            <div className="text-sm text-loss leading-relaxed p-3 rounded-lg bg-loss/10 border border-loss/20">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 mt-auto pt-4">
            <Button
              type="button"
              variant="ghost"
              className="h-11 flex-1 font-semibold"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-11 flex-1 font-semibold bg-loss text-white hover:bg-loss/80"
              onClick={handle}
              disabled={pending}
            >
              {pending
                ? "Disconnecting…"
                : purge
                  ? "Delete & disconnect"
                  : "Disconnect"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
