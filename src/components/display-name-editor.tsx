"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { updateDisplayName } from "@/app/actions/profile";
import { cn } from "@/lib/utils";

/**
 * Inline-editable display name. Click the name (or the pencil) to swap into
 * an input with Save/Cancel. Uses useTransition for loading state.
 *
 * Shows `fallback` when the actual display_name is null — typically the email
 * prefix, styled muted so the user knows it's derived, not set.
 */
export function DisplayNameEditor({
  initial,
  fallback,
}: {
  initial: string | null;
  fallback: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial ?? "");
  const [committed, setCommitted] = useState<string | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const displayed = committed && committed.trim() ? committed : fallback;
  const isFallback = !committed || !committed.trim();

  function handleSave() {
    const trimmed = value.trim();
    if (trimmed === (committed ?? "")) {
      setEditing(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await updateDisplayName(trimmed);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCommitted(trimmed || null);
      setEditing(false);
    });
  }

  function handleCancel() {
    setValue(committed ?? "");
    setError(null);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
            disabled={pending}
            maxLength={60}
            placeholder="What should we call you?"
            className={cn(
              "bg-transparent border-b border-gold outline-none",
              "font-display text-3xl font-bold leading-none tracking-tight",
              "text-gold placeholder:text-text-muted/60",
              "w-full max-w-[360px]",
              pending && "opacity-50",
            )}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="text-xs text-gold font-semibold hover:underline disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <span className="text-text-muted text-xs">·</span>
          <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            className="text-xs text-text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          {error && <span className="text-xs text-loss ml-2">{error}</span>}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "group inline-flex items-baseline gap-1.5 text-left",
        "font-display text-3xl font-bold leading-none tracking-tight",
      )}
      aria-label="Edit display name"
    >
      <span className={isFallback ? "text-text-muted" : "text-gold"}>
        {displayed}
      </span>
      <span
        aria-hidden
        className="text-xs font-medium text-text-muted opacity-0 group-hover:opacity-100 transition-opacity translate-y-[-2px]"
      >
        edit
      </span>
    </button>
  );
}
