"use client";

import { useState, useTransition } from "react";
import { ConnectWalletDialog } from "@/components/connect-wallet-dialog";
import { DisconnectWalletDialog } from "@/components/disconnect-wallet-dialog";
import { resyncWallet } from "@/app/actions/wallets";

export type ConnectedWalletRow = {
  id: string;
  address: string;
  ens_name: string | null;
  label: string | null;
  last_synced_at: string | null;
  token_count: number;
  total_usd_in_base: number | null;
};

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never synced";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const FMT_MONEY = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
};

export function ConnectedWalletsSection({
  wallets,
  baseCurrency,
}: {
  wallets: ConnectedWalletRow[];
  baseCurrency: string;
}) {
  const [connectOpen, setConnectOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState<ConnectedWalletRow | null>(
    null,
  );
  const [resyncing, setResyncing] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleResync(id: string) {
    setResyncing(id);
    startTransition(async () => {
      await resyncWallet(id);
      setResyncing(null);
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-plex text-[11px] text-text-muted uppercase tracking-[0.14em] font-medium">
          Wallets
        </h2>
        <button
          type="button"
          onClick={() => setConnectOpen(true)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-surface text-text-secondary font-semibold text-xs hover:bg-surface-hover border border-border transition-colors"
        >
          + Connect wallet
        </button>
      </div>

      {wallets.length === 0 ? (
        <div className="f3-card p-6 flex flex-col items-start gap-3">
          <div className="flex flex-col gap-1">
            <div className="font-sans text-base font-bold">No wallet connected</div>
            <div className="text-sm text-text-secondary max-w-[420px] leading-relaxed">
              Paste a public address or sign in with MetaMask / Binance Web3
              Wallet. We&apos;ll sync balances across Ethereum, Base, Arbitrum,
              Optimism, Polygon, and BNB Chain. Read-only — we never spend.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConnectOpen(true)}
            className="text-sm font-semibold text-gold hover:text-gold/80 transition-colors"
          >
            Connect wallet →
          </button>
        </div>
      ) : (
        <div className="flex flex-col rounded-lg bg-surface border border-border divide-y divide-border overflow-hidden">
          {wallets.map((w) => {
            const display = w.label ?? w.ens_name ?? shortAddress(w.address);
            const sub =
              w.ens_name && w.label
                ? `${w.ens_name} · ${shortAddress(w.address)}`
                : shortAddress(w.address);
            return (
              <div
                key={w.id}
                className="flex items-center gap-3 p-4 hover:bg-surface-hover transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-gold-dim text-gold text-[10px] font-bold flex items-center justify-center shrink-0">
                  ETH
                </div>
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-base font-bold truncate">
                      {display}
                    </span>
                    <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
                      Wallet
                    </span>
                  </div>
                  <div className="text-xs text-text-muted truncate font-mono">
                    {sub} · {w.token_count}{" "}
                    {w.token_count === 1 ? "token" : "tokens"} ·{" "}
                    {relativeTime(w.last_synced_at)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <div className="font-display text-base font-bold tabular-nums">
                    {w.total_usd_in_base != null
                      ? FMT_MONEY(w.total_usd_in_base, baseCurrency)
                      : "—"}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-text-muted uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => handleResync(w.id)}
                      disabled={resyncing === w.id}
                      className="hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      {resyncing === w.id ? "Syncing…" : "Resync"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisconnecting(w)}
                      className="hover:text-loss transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConnectWalletDialog open={connectOpen} onOpenChange={setConnectOpen} />
      <DisconnectWalletDialog
        walletId={disconnecting?.id ?? null}
        walletLabel={
          disconnecting?.label ??
          disconnecting?.ens_name ??
          (disconnecting ? shortAddress(disconnecting.address) : null)
        }
        onClose={() => setDisconnecting(null)}
      />
    </section>
  );
}
