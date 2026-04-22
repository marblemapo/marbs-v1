"use client";

import { useState } from "react";
import { DeleteAccountDialog } from "@/components/delete-account-dialog";

/**
 * Tiny danger-zone strip at the bottom of the dashboard. Muted by default —
 * it's not something we want users tripping into, but it has to be findable.
 */
export function DangerZone({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="pt-8 flex items-center justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-plex text-[11px] text-text-muted/60 hover:text-loss transition-colors uppercase tracking-wider"
        >
          Delete account
        </button>
      </div>
      <DeleteAccountDialog open={open} onOpenChange={setOpen} email={email} />
    </>
  );
}
