"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateAssetQuantity, deleteAsset } from "@/app/actions/assets";

export type EditableAsset = {
  id: string;
  name: string;
  symbol: string | null;
  asset_class: "equity" | "etf" | "crypto" | "cash";
  native_currency: string;
  latest_quantity: number | null;
  latest_price: number | null;
};

const CLASS_LABEL: Record<EditableAsset["asset_class"], string> = {
  equity: "Stock",
  etf: "ETF",
  crypto: "Crypto",
  cash: "Cash",
};

/**
 * Sheet-based edit panel. Open with an EditableAsset, closed by setting asset
 * to null. Exposes:
 *   - Update quantity (creates a new balance_snapshots row)
 *   - Delete (cascades to snapshots via FK)
 *
 * Delete uses a 2-click confirm pattern: first click arms "Confirm delete",
 * second click actually runs the action. Simpler than a nested dialog, and
 * the ~2s TTL auto-disarms if user walks away.
 */
export function EditAssetDrawer({
  asset,
  onClose,
}: {
  asset: EditableAsset | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState<string>(() =>
    asset?.latest_quantity?.toString() ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const nextQuantity = Number(quantity);
  const currentValue =
    asset?.latest_quantity != null && asset.latest_price != null
      ? asset.latest_quantity * asset.latest_price
      : null;
  const nextValue =
    asset?.latest_price != null &&
    quantity.trim() !== "" &&
    Number.isFinite(nextQuantity) &&
    nextQuantity > 0
      ? nextQuantity * asset.latest_price
      : null;
  const valueChange =
    currentValue != null && nextValue != null ? nextValue - currentValue : null;

  // Reset state whenever a different asset is opened.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (asset) {
      setQuantity(asset.latest_quantity?.toString() ?? "");
      setError(null);
      setConfirmDelete(false);
    }
  }, [asset]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleClose() {
    setError(null);
    setConfirmDelete(false);
    setQuantity("");
    onClose();
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!asset) return;
    setError(null);
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || !(qty > 0)) {
      setError("Quantity must be greater than zero");
      return;
    }
    startTransition(async () => {
      const res = await updateAssetQuantity(asset.id, qty);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      handleClose();
      router.refresh();
    });
  }

  async function handleDelete() {
    if (!asset) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      // Auto-disarm after 3s
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    startTransition(async () => {
      const res = await deleteAsset(asset.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      handleClose();
      router.refresh();
    });
  }

  return (
    <Sheet
      open={!!asset}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <SheetContent side="right" className="f3-theme w-full sm:max-w-[440px] flex flex-col gap-0 p-0 border-l border-white/[0.08]">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="font-display text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <span>{asset?.symbol ?? asset?.name}</span>
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
              {asset && CLASS_LABEL[asset.asset_class]}
            </span>
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSave} className="flex flex-col flex-1 gap-5 px-6 pb-6 overflow-y-auto">
          {/* Current market snapshot + live preview of the edited balance. */}
          {asset && (
            <div className="grid grid-cols-2 gap-px bg-border rounded-lg overflow-hidden">
              <div className="bg-surface p-4 flex flex-col gap-0.5">
                <div className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
                  Last price
                </div>
                <div className="font-display text-base font-bold tabular-nums">
                  {asset.latest_price != null
                    ? `${asset.native_currency} ${asset.latest_price.toLocaleString("en-US", { maximumFractionDigits: 4 })}`
                    : asset.asset_class === "cash"
                      ? "Cash"
                      : "—"}
                </div>
              </div>
              <div className="bg-surface p-4 flex flex-col gap-0.5">
                <div className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
                  New value
                </div>
                <div className="font-display text-base font-bold tabular-nums">
                  {nextValue != null
                    ? `${asset.native_currency} ${nextValue.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
                    : "—"}
                </div>
                {valueChange != null && Math.abs(valueChange) > 0.000001 && (
                  <div
                    className={`text-[11px] tabular-nums ${
                      valueChange >= 0 ? "text-[#00E5A0]" : "text-[#FF5000]"
                    }`}
                  >
                    {valueChange >= 0 ? "+" : "−"}
                    {asset.native_currency} {Math.abs(valueChange).toLocaleString("en-US", {
                      maximumFractionDigits: 2,
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quantity" className="text-[11px] text-text-muted uppercase tracking-wider font-medium">
              {asset?.asset_class === "cash" ? "Balance" : "Quantity"}
            </Label>
            <Input
              id="quantity"
              type="number"
              step="any"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              inputMode="decimal"
              autoFocus
              className="h-11 tabular-nums"
            />
            <p className="text-xs text-text-muted">
              Saves a dated balance record and refreshes net worth immediately.
            </p>
          </div>

          {error && (
            <div className="text-sm text-loss leading-relaxed p-3 rounded-lg bg-loss/10 border border-loss/20">
              {error}
            </div>
          )}

          {/* Action row */}
          <div className="flex items-center gap-2 mt-auto pt-4">
            <Button
              type="button"
              variant="ghost"
              className="h-11 flex-1 font-semibold"
              onClick={handleClose}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-11 flex-1 font-semibold"
              disabled={pending}
            >
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>

          {/* Delete (destructive, 2-click confirm) */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className={`mt-2 h-11 rounded-lg font-semibold text-sm transition-colors border ${
              confirmDelete
                ? "bg-loss text-background border-loss hover:bg-loss/90"
                : "text-loss border-loss/30 hover:bg-loss/10"
            } disabled:opacity-50`}
          >
            {confirmDelete ? "Confirm delete — click again" : "Delete asset"}
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
