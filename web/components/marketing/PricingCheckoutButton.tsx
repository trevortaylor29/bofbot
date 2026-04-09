"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";

import type { CheckoutPaidPlan } from "@/lib/checkout-plans";

/**
 * Free tier: no Stripe. Logged-in → dashboard; logged-out → signup (free plan is default after signup).
 */
export function PricingFreeCta({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  const { status } = useSession();
  const router = useRouter();

  function onClick() {
    if (status === "loading") return;
    if (status === "authenticated") {
      router.push("/dashboard");
      return;
    }
    router.push("/signup");
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={status === "loading"}
      className={className}
    >
      {children}
    </button>
  );
}

export function PricingCheckoutButton({
  plan,
  className,
  children,
  showCancelNote,
}: {
  plan: CheckoutPaidPlan;
  className: string;
  children: React.ReactNode;
  showCancelNote?: boolean;
}) {
  const { status } = useSession();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  function onClick() {
    if (status === "unauthenticated") {
      const next = encodeURIComponent(`/?checkout=${plan}`);
      router.push(`/signup?callbackUrl=${next}`);
      return;
    }
    if (status === "loading") return;

    /**
     * Full-page navigation to GET `/api/checkout/start` → 302 to Stripe.
     * Do not use `fetch("/api/checkout")` here: XHR responses were clearing Auth.js cookies.
     */
    setPending(true);
    window.location.assign(`/api/checkout/start?plan=${encodeURIComponent(plan)}`);
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={pending || status === "loading"}
        className={className}
      >
        {pending ? "Redirecting…" : children}
      </button>
      {showCancelNote ? (
        <p className="mt-2 text-center text-[10px] tracking-wide text-zinc-600">
          Cancel anytime
        </p>
      ) : null}
    </div>
  );
}
