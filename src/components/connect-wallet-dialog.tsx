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

type Row = {
  id: string;
  address: string;
  label: string;
  error: string | null;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function blank(): Row {
  return { id: uid(), address: "", label: "", error: null };
}

const CHAINS = [
  "Ethereum",
  "Base",
  "Arbitrum",
  "Optimism",
  "Polygon",
  "BNB Chain",
];

export function ConnectWalletDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setRows([blank()]);
    setGlobalError(null);
  }

  function patch(id: string, p: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }

  function addRow() {
    setRows((rs) => [...rs, blank()]);
  }

  function removeRow(id: string) {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGlobalError(null);

    // Only rows with non-empty address are submitted. Empty rows are ignored
    // so users can have a trailing blank without it being an error.
    const active = rows.filter((r) => r.address.trim().length > 0);
    if (active.length === 0) {
      setGlobalError("Paste at least one address or ENS name.");
      return;
    }

    // Clear any row-level errors before retrying.
    setRows((rs) => rs.map((r) => ({ ...r, error: null })));

    startTransition(async () => {
      // Fire all connects in parallel — the server action upserts so a
      // duplicate address is a no-op rather than an error.
      const results = await Promise.all(
        active.map((r) =>
          connectWallet({
            input: r.address.trim(),
            label: r.label.trim() || null,
            method: "address",
          }).then((res) => ({ id: r.id, res })),
        ),
      );

      const failed: string[] = [];
      for (const { id, res } of results) {
        if (!res.ok) {
          failed.push(id);
          patch(id, { error: res.error });
        }
      }

      if (failed.length === 0) {
        onOpenChange(false);
        reset();
        return;
      }

      // Keep the dialog open with only the failed rows. Succeeded rows are
      // already saved — drop them from the form so the user isn't confused
      // about what's still pending.
      setRows((rs) => rs.filter((r) => failed.includes(r.id) || !active.find((a) => a.id === r.id)));
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
            Connect wallets
          </SheetTitle>
          <p className="text-sm text-text-secondary mt-2 leading-relaxed">
            Read-only sync of EVM addresses. We never take custody, never sign
            transactions, and only read public balances. Disconnect any time.
          </p>
          <div className="flex flex-col gap-1.5 mt-3">
            <span className="font-plex text-[10px] text-text-muted uppercase tracking-wider">
              Chains we&apos;ll scan
            </span>
            <div className="flex flex-wrap gap-1.5">
              {CHAINS.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 h-6 px-2 rounded-pill bg-gold-dim text-gold text-[11px] font-semibold"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 gap-4 px-6 pb-6 overflow-y-auto"
        >
          <div className="flex flex-col gap-4">
            {rows.map((r, idx) => (
              <div
                key={r.id}
                className="flex flex-col gap-1.5 p-3 rounded-lg bg-surface/50 border border-border"
              >
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor={`addr-${r.id}`}
                    className="text-[11px] text-text-muted uppercase tracking-wider font-medium"
                  >
                    Wallet {rows.length > 1 ? idx + 1 : ""}
                  </Label>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(r.id)}
                      aria-label="Remove wallet"
                      className="h-6 w-6 flex items-center justify-center rounded-md text-text-muted hover:text-loss hover:bg-surface-hover transition-colors"
                    >
                      ×
                    </button>
                  )}
                </div>
                <Input
                  id={`addr-${r.id}`}
                  value={r.address}
                  onChange={(e) => patch(r.id, { address: e.target.value })}
                  placeholder="0x… or vitalik.eth"
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus={idx === 0}
                  className="h-11 font-mono text-sm"
                />
                <Input
                  value={r.label}
                  onChange={(e) => patch(r.id, { label: e.target.value })}
                  placeholder="Label (optional) — Hot wallet · Hardware"
                  autoComplete="off"
                  className="h-9 text-sm"
                />
                {r.error && (
                  <div className="text-xs text-loss leading-relaxed">
                    {r.error}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addRow}
            className="self-start text-xs text-gold hover:text-gold/80 font-semibold transition-colors"
          >
            + Add another wallet
          </button>

          {globalError && (
            <div className="text-sm text-loss leading-relaxed p-3 rounded-lg bg-loss/10 border border-loss/20">
              {globalError}
            </div>
          )}

          <p className="text-xs text-text-muted leading-relaxed mt-auto">
            Find addresses in your wallet app under <em>Receive</em> or
            <em> Account details</em>. Addresses are public on-chain — anyone
            can see balances.
          </p>

          <div className="flex items-center gap-2 pt-2">
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
              {pending
                ? "Syncing…"
                : rows.filter((r) => r.address.trim()).length > 1
                  ? `Connect ${rows.filter((r) => r.address.trim()).length} wallets`
                  : "Connect"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
