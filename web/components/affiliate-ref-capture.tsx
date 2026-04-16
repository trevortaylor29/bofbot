"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

import { sanitizeAffiliateRef } from "@/lib/affiliate-ref";

/**
 * Syncs `?ref=` into the HttpOnly affiliate cookie on client-side navigations.
 * Full-page loads are covered by `middleware.ts`.
 */
export function AffiliateRefCapture() {
  const searchParams = useSearchParams();
  const doneKey = useRef<string | null>(null);

  useEffect(() => {
    const ref = sanitizeAffiliateRef(searchParams.get("ref"));
    if (!ref) return;
    if (doneKey.current === ref) return;
    doneKey.current = ref;

    void fetch("/api/affiliate/set-ref", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref }),
      credentials: "include",
    }).catch(() => {
      doneKey.current = null;
    });
  }, [searchParams]);

  return null;
}
