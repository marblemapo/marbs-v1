"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";

type Status = "idle" | "sending" | "sent" | "verifying" | "error";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [codeError, setCodeError] = useState("");

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

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    const token = code.trim();
    if (token.length !== 6) {
      setCodeError("Enter the 6-digit code from your email.");
      return;
    }
    setStatus("verifying");
    setCodeError("");

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error) {
      setStatus("sent");
      setCodeError(error.message);
      return;
    }

    // Middleware routes new users to /onboarding, existing users to /dashboard.
    router.push("/dashboard");
    router.refresh();
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
          {"// enter your email. we'll send a link and a 6-digit code. no password to remember."}
        </p>

        {/* Form block — constrained to the form itself */}
        <div className="max-w-[460px]">
          {status === "sent" || status === "verifying" ? (
            <div className="rounded-[14px] border border-white/[0.08] bg-[#0A0A0A] p-6">
              <div className="flex items-center gap-2 font-plex text-[13px] font-semibold text-[#7FFFD4] mb-3">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-[#7FFFD4] f3-pulse"
                  style={{ boxShadow: "0 0 10px #7FFFD4" }}
                />
                CHECK YOUR EMAIL
              </div>
              <p className="text-sm text-text-secondary leading-relaxed mb-5">
                We sent a magic link and a 6-digit code to{" "}
                <span className="font-plex text-foreground">{email}</span>.
                Click the link, or paste the code below.
              </p>

              <form onSubmit={handleVerifyCode} className="flex flex-col gap-3">
                <label
                  htmlFor="code"
                  className="font-plex text-[11px] text-text-muted uppercase tracking-[0.14em] font-medium"
                >
                  {"// 6-digit code"}
                </label>
                <Input
                  id="code"
                  type="text"
                  name="code"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoFocus
                  disabled={status === "verifying"}
                  className="h-12 bg-[#0A0A0A] border-white/[0.08] font-plex text-lg tracking-[0.4em] tabular-nums placeholder:text-text-muted/40 placeholder:tracking-[0.4em] focus-visible:border-[#7FFFD4] focus-visible:ring-[#7FFFD4]/30"
                />
                <div className="flex items-center gap-4 mt-2">
                  <button
                    type="submit"
                    disabled={status === "verifying" || code.length !== 6}
                    aria-disabled={
                      status === "verifying" || code.length !== 6
                    }
                    className="f3-cta"
                  >
                    {status === "verifying" ? "Verifying…" : "Verify code"}
                  </button>
                  <span className="font-plex text-[12px] text-text-muted">
                    Or click the link in your email
                  </span>
                </div>
                {codeError && (
                  <p className="font-plex text-sm text-loss mt-1">
                    {codeError}
                  </p>
                )}
              </form>

              <button
                type="button"
                onClick={() => {
                  setStatus("idle");
                  setCode("");
                  setCodeError("");
                }}
                className="font-plex text-[11px] text-text-muted hover:text-[#7FFFD4] transition-colors tracking-wider uppercase mt-5"
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
                  {status === "sending" ? "Sending…" : "Sign in"}
                </button>
                <span className="font-plex text-[12px] text-text-muted">
                  Magic link or 6-digit code · no password
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
