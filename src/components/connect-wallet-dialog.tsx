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
import { cn } from "@/lib/utils";
import { connectWallet, createSiweChallenge } from "@/app/actions/wallets";

type Mode = "address" | "signature";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function ConnectWalletDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [mode, setMode] = useState<Mode>("address");
  const [input, setInput] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setMode("address");
    setInput("");
    setLabel("");
    setError(null);
    setStatus(null);
  }

  async function handleAddressSubmit(e: FormEvent<HTMLFormElement>) {
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
        method: "address",
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onOpenChange(false);
      reset();
    });
  }

  async function handleSignatureConnect() {
    setError(null);
    setStatus(null);
    if (typeof window === "undefined" || !window.ethereum) {
      setError(
        "No browser wallet detected. Install MetaMask or use the paste-address option.",
      );
      return;
    }

    startTransition(async () => {
      try {
        setStatus("Opening wallet…");
        const accounts = (await window.ethereum!.request({
          method: "eth_requestAccounts",
        })) as string[];
        const address = accounts?.[0];
        if (!address) {
          setError("Wallet didn't return an address.");
          setStatus(null);
          return;
        }

        setStatus("Preparing signature request…");
        const challenge = await createSiweChallenge({
          address,
          domain: window.location.host,
          uri: window.location.origin,
        });
        if ("error" in challenge) {
          setError(challenge.error);
          setStatus(null);
          return;
        }

        setStatus("Waiting for you to sign in your wallet…");
        const signature = (await window.ethereum!.request({
          method: "personal_sign",
          params: [challenge.message, address],
        })) as `0x${string}`;

        setStatus("Syncing balances…");
        const res = await connectWallet({
          input: address,
          label: label.trim() || null,
          method: "signature",
          message: challenge.message,
          signature,
        });
        if (!res.ok) {
          setError(res.error);
          setStatus(null);
          return;
        }
        onOpenChange(false);
        reset();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Connection failed";
        // Swallow user-rejection errors into a friendly copy.
        if (/rejected|denied/i.test(msg)) {
          setError("You cancelled the signature request.");
        } else {
          setError(msg);
        }
        setStatus(null);
      }
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

        <div className="flex flex-col flex-1 gap-5 px-6 pb-6 overflow-y-auto">
          {/* Mode picker */}
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] text-text-muted uppercase tracking-wider font-medium">
              Method
            </Label>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                { id: "address", label: "Paste address" },
                { id: "signature", label: "Connect wallet" },
              ] as const).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setMode(m.id);
                    setError(null);
                    setStatus(null);
                  }}
                  className={cn(
                    "h-10 rounded-lg text-sm font-semibold transition-colors border",
                    mode === m.id
                      ? "bg-gold text-primary-foreground border-gold"
                      : "bg-surface text-text-secondary border-border hover:bg-surface-hover",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-text-muted">
              {mode === "address"
                ? "Watch-only: paste any public address or ENS. No signing."
                : "Sign a message to prove you own the connected wallet. No transactions."}
            </p>
          </div>

          {/* Label */}
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
              name="walletLabel"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Hot wallet · Hardware · Vitalik"
              autoComplete="off"
              className="h-11"
            />
          </div>

          {mode === "address" ? (
            <form onSubmit={handleAddressSubmit} className="flex flex-col gap-5">
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
                  This address is public on Ethereum — anyone can see its
                  balances.
                </p>
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
          ) : (
            <div className="flex flex-col gap-5">
              <div className="text-sm text-text-secondary leading-relaxed">
                We&apos;ll ask your browser wallet (MetaMask, Rabby, Coinbase
                Wallet, Binance Web3 Wallet) to sign a plain-text message proving
                you own the address. The message grants no spend or approval
                rights.
              </div>

              {status && (
                <div className="text-sm text-text-secondary p-3 rounded-lg bg-surface border border-border">
                  {status}
                </div>
              )}

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
                  type="button"
                  className="h-11 flex-1 font-semibold"
                  onClick={handleSignatureConnect}
                  disabled={pending}
                >
                  {pending ? "Connecting…" : "Connect wallet"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
