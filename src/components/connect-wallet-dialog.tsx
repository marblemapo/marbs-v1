"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { connectWallet } from "@/app/actions/wallets";

export function ConnectWalletDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [input, setInput] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setInput("");
    setLabel("");
    setError(null);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!input.trim()) {
      setError("Paste an Ethereum address or ENS name.");
      return;
    }
    startTransition(async () => {
      const res = await connectWallet({
        input: input.trim(),
        label: label.trim() || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onOpenChange(false);
      reset();
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <SheetContent
        side="right"
        className="f3-theme w-full sm:max-w-[440px] flex flex-col gap-0 p-0 border-l border-white/[0.08]"
      >
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="font-display text-2xl font-bold tracking-tight">
            Connect a wallet
          </SheetTitle>
          <p className="text-sm text-text-secondary mt-2 leading-relaxed">
            Read-only sync of an EVM address across Ethereum, Base, Arbitrum,
            Optimism, Polygon, and BNB Chain. We never take custody, never sign
            transactions, and only read public balances. Disconnect any time.
          </p>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 gap-5 px-6 pb-6 overflow-y-auto"
        >
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="walletInput"
              className="text-[11px] text-text-muted uppercase tracking-wider font-medium"
            >
              Address or ENS
            </Label>
            <Input
              id="walletInput"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="0x… or vitalik.eth"
              autoComplete="off"
              spellCheck={false}
              autoFocus
              className="h-11 font-mono text-sm"
            />
            <p className="text-xs text-text-muted">
              Find this in your wallet app under Receive or Account details.
              Public on-chain — anyone can see balances.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="walletLabel"
              className="text-[11px] text-text-muted uppercase tracking-wider font-medium"
            >
              Label
              <span className="text-text-muted/60 normal-case tracking-normal font-normal ml-1.5">
                · optional
              </span>
            </Label>
            <Input
              id="walletLabel"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Hot wallet · Hardware · Binance Web3"
              autoComplete="off"
              className="h-11"
            />
          </div>

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
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-11 flex-1 font-semibold"
              disabled={pending}
            >
              {pending ? "Syncing…" : "Connect"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
