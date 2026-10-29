"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { PageSkeleton } from "@/components/clarity/page-skeleton";

export function VaultLink({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const [entering, setEntering] = useState(false);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    router.prefetch("/dashboard");

    return () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    };
  }, [router]);

  function enterVault(event: MouseEvent<HTMLAnchorElement>) {
    // Preserve the browser's normal new-tab and modified-click behaviour.
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    if (entering) return;

    setEntering(true);

    // Give React one frame to paint the prefetched dashboard shell before
    // starting navigation, so there is never a blank frame between routes.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        router.push("/dashboard");
        resetTimer.current = window.setTimeout(
          () => setEntering(false),
          10_000,
        );
      });
    });
  }

  return (
    <>
      <Link
        href="/dashboard"
        prefetch
        onClick={enterVault}
        onPointerEnter={() => router.prefetch("/dashboard")}
        onFocus={() => router.prefetch("/dashboard")}
        aria-busy={entering}
        className={className}
      >
        {children}
      </Link>
      {entering && (
        <div
          className="vault-route-transition pointer-events-none fixed inset-0 z-[100] flex"
          role="status"
          aria-label="Opening your vault"
        >
          <PageSkeleton variant="overview" />
        </div>
      )}
    </>
  );
}
