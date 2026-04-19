"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
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
    <main className="f3-stage flex-1 flex items-center">
      <div className="mx-auto w-full max-w-[780px] px-6 py-12 flex flex-col f3-fade-in">
        {/* Top bar — identical structure to landing */}
        <div className="flex items-center justify-between mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill bg-white/[0.04] border border-white/[0.08] font-plex text-[12px] font-medium text-[#EBEBF5] tracking-wide">
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#7FFFD4] f3-pulse"
              style={{ boxShadow: "0 0 10px #7FFFD4" }}
            />
            Wealth · v1
          </div>
          <nav className="flex items-center gap-6 font-plex text-[12px] font-medium text-text-muted">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <a
              href="https://github.com/marblemapo/marbs-v1"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Docs
            </a>
            <span className="text-foreground">Sign in</span>
          </nav>
        </div>

        {/* Hero — matches landing scale */}
        <h1 className="font-sans font-bold text-5xl md:text-[48px] leading-[1.02] tracking-[-0.03em] mb-4">
          Sign in to
          <br />
          <span className="text-[#7FFFD4]">Wealth.</span>
        </h1>
        <p className="font-plex text-sm text-text-muted max-w-[460px] mb-10">
          {"// enter your email. we'll send a magic link. no password to remember."}
        </p>

        {/* Form block — constrained to the form itself */}
        <div className="max-w-[460px]">
          {status === "sent" ? (
            <div className="rounded-[14px] border border-white/[0.08] bg-[#0A0A0A] p-6">
              <div className="flex items-center gap-2 font-plex text-[13px] font-semibold text-[#7FFFD4] mb-3">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-[#7FFFD4] f3-pulse"
                  style={{ boxShadow: "0 0 10px #7FFFD4" }}
                />
                CHECK YOUR EMAIL
              </div>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                We sent a magic link to{" "}
                <span className="font-plex text-foreground">{email}</span>.
                Click it to finish signing in. You can close this tab.
              </p>
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="font-plex text-[11px] text-text-muted hover:text-[#7FFFD4] transition-colors tracking-wider uppercase"
              >
                Wrong email? Start over
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="email"
                  className="font-plex text-[11px] text-text-muted uppercase tracking-[0.14em] font-medium"
                >
                  {"// email"}
                </label>
                <Input
                  id="email"
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  autoComplete="email"
                  disabled={status === "sending"}
                  className="h-12 bg-[#0A0A0A] border-white/[0.08] font-plex text-base placeholder:text-text-muted focus-visible:border-[#7FFFD4] focus-visible:ring-[#7FFFD4]/30"
                />
              </div>
              <div className="flex items-center gap-4 mt-3">
                <button
                  type="submit"
                  disabled={status === "sending" || !email}
                  aria-disabled={status === "sending" || !email}
                  className="f3-cta"
                >
                  {status === "sending"
                    ? "Sending magic link…"
                    : "Send magic link"}
                </button>
                <span className="font-plex text-[12px] text-text-muted">
                  Magic link · no password
                </span>
              </div>
              {status === "error" && (
                <p className="font-plex text-sm text-loss mt-2">{errorMsg}</p>
              )}
            </form>
          )}

          <div className="font-plex text-[11px] text-text-muted leading-relaxed border-t border-white/[0.08] pt-5 mt-10">
            {"// new here? set your display name from the dashboard once signed in."}
            <br />
            {"// by signing in, you agree to let Wealth store your asset data in its database. no bank logins, no plaid. entry is manual."}
          </div>
        </div>
      </div>
    </main>
  );
}
