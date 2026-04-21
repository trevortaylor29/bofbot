"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Shown when a logged-in free user is sent to pricing to subscribe for the app download.
 * Query: `/?subscribe_download=1#pricing`
 */
export function SubscribeDownloadBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const show = searchParams.get("subscribe_download") === "1" && !dismissed;

  useEffect(() => {
    if (!show) return;
    const id = requestAnimationFrame(() => {
      document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [show]);

  if (!show) return null;

  function dismiss() {
    setDismissed(true);
    router.replace("/", { scroll: false });
  }

  return (
    <div
      role="status"
      className="sticky top-16 z-40 border-b border-amber-900/60 bg-amber-950/95 px-4 py-3 text-center text-sm text-amber-100 shadow-lg shadow-black/20 backdrop-blur-md sm:px-6"
    >
      <div className="mx-auto flex max-w-3xl items-center justify-center gap-3">
        <p className="font-medium">Subscribe to download BofBot.</p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md border border-amber-800/80 px-2 py-0.5 text-xs font-medium text-amber-200/90 transition hover:bg-amber-900/50"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
