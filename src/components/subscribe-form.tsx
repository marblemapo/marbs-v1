"use client";

import { useState } from "react";

export function SubscribeForm({ source = "landing" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/notebook/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setStatus("ok");
      setMessage(data.alreadySubscribed ? "You're already on the list." : "Subscribed — thanks!");
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@domain.com"
        disabled={status === "loading"}
        className="flex-1 px-4 py-2.5 rounded-full border border-neutral-300 bg-white text-[14px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-500 disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={status === "loading" || !email}
        className="text-[14px] font-semibold px-5 py-2.5 rounded-full bg-black text-white hover:bg-neutral-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === "loading" ? "Subscribing…" : "Subscribe"}
      </button>
      {message ? (
        <p className={`text-[13px] sm:basis-full ${status === "error" ? "text-red-600" : "text-neutral-600"}`}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
