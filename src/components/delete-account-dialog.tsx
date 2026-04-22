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
import { deleteAccount } from "@/app/actions/account";

export function DeleteAccountDialog({
  open,
  onOpenChange,
  email,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  email: string;
}) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const match = typed.trim().toLowerCase() === email.trim().toLowerCase();

  function reset() {
    setTyped("");
    setError(null);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!match) {
      setError("Type your email exactly to confirm.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await deleteAccount(typed);
      // On success the action redirects — we never get here. If we do,
      // something upstream failed.
      if (res && !res.ok) setError(res.error);
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
            Delete account
          </SheetTitle>
          <p className="text-sm text-text-secondary mt-2 leading-relaxed">
            This wipes your account and every asset, snapshot, goal, and
            connected wallet tied to it. There&apos;s no recovery — you can
            sign up again fresh if you change your mind.
          </p>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 gap-5 px-6 pb-6 overflow-y-auto"
        >
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="confirmEmail"
              className="text-[11px] text-text-muted uppercase tracking-wider font-medium"
            >
              Type <span className="text-foreground">{email}</span> to confirm
            </Label>
            <Input
              id="confirmEmail"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={email}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="h-11 font-mono text-sm"
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
              className="h-11 flex-1 font-semibold bg-loss text-white hover:bg-loss/80 disabled:opacity-40"
              disabled={pending || !match}
            >
              {pending ? "Deleting…" : "Delete account"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
