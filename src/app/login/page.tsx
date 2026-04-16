"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // Stored in auth.users.raw_user_meta_data. Only used on first sign-up
        // via the handle_new_user trigger. Ignored for returning users.
        data: name ? { display_name: name.trim() } : undefined,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="w-full max-w-[420px] flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold leading-none tracking-tight">
            Sign in to <span className="text-gold">Marbs</span>
          </h1>
          <p className="text-sm leading-relaxed text-text-secondary">
            Enter your email and we&apos;ll send a magic link. No password to remember.
          </p>
        </div>

        {status === "sent" ? (
          <div className="flex flex-col gap-3 p-5 rounded-lg bg-surface border border-border">
            <div className="flex items-center gap-2 text-gain font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-gain pulse-live" />
              Check your email
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              We sent a magic link to <span className="text-foreground font-medium">{email}</span>.
              Click it to finish signing in. You can close this tab.
            </p>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="text-xs text-text-muted hover:text-foreground transition-colors text-left"
            >
              Wrong email? Start over.
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-[11px] text-text-muted uppercase tracking-wider font-medium">
                Name
                <span className="text-text-muted/60 normal-case tracking-normal font-normal ml-1.5">· optional, first sign-in only</span>
              </label>
              <Input
                id="name"
                type="text"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="How should we address you?"
                autoComplete="name"
                disabled={status === "sending"}
                className="h-11"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-[11px] text-text-muted uppercase tracking-wider font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                disabled={status === "sending"}
                className="h-11"
              />
            </div>
            <Button
              type="submit"
              disabled={status === "sending" || !email}
              className="h-11 font-semibold mt-1"
            >
              {status === "sending" ? "Sending magic link…" : "Send magic link"}
            </Button>
            {status === "error" && (
              <p className="text-sm text-loss leading-relaxed">{errorMsg}</p>
            )}
          </form>
        )}

        <div className="text-xs text-text-muted leading-relaxed border-t border-border pt-4">
          By signing in, you agree to let Marbs store your asset data in its
          database. No bank logins, no Plaid. Entry is manual.
        </div>
      </div>
    </main>
  );
}
