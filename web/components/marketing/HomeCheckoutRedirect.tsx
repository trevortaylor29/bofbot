"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { isCheckoutPaidPlan } from "@/lib/checkout-plans";

/**
 * After signup/login with `/?checkout=starter|pro`, continue to Stripe when session exists.
 */
export function HomeCheckoutRedirect() {
  const { status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    const raw = searchParams.get("checkout");
    if (raw === "cancel" || raw === "canceled") {
      router.replace("/#pricing");
      return;
    }
    if (raw === "error") {
      router.replace("/#pricing");
      return;
    }
    if (!raw || !isCheckoutPaidPlan(raw)) return;
    if (status !== "authenticated") return;
    if (started.current) return;
    started.current = true;

    window.location.assign(
      `/api/checkout/start?plan=${encodeURIComponent(raw)}`
    );
  }, [searchParams, status, router]);

  return null;
}
