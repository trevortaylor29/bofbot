"use client";

import Link from "next/link";
import { useState } from "react";

import { BofBotInstallerDownloadDashboard } from "@/components/bofbot-installer-download";

export function BillingPortalButton({
  hasStripeCustomer,
}: {
  hasStripeCustomer: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setPending(true);
    try {
      const r = await fetch("/api/billing-portal", {
        method: "POST",
        credentials: "include",
      });
      const d = (await r.json().catch(() => ({}))) as {
        error?: string;
        url?: string;
      };
      if (!r.ok) {
        setError(d.error ?? "Could not open billing portal");
        setPending(false);
        return;
      }
      if (d.url) {
        window.location.href = d.url;
        return;
      }
      setError("No portal URL returned");
    } catch {
      setError("Network error");
    }
    setPending(false);
  }

  if (!hasStripeCustomer) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
        <p className="text-sm text-zinc-400">
          Billing management unlocks after you subscribe to{" "}
          <span className="text-zinc-200">Starter</span> or{" "}
          <span className="text-zinc-200">Pro</span>.
        </p>
        <Link
          href="/#pricing"
          className="mt-3 inline-block text-sm font-medium text-[#F43F5E] hover:underline"
        >
          View pricing →
        </Link>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50 sm:w-auto"
      >
        {pending ? "Opening…" : "Manage subscription"}
      </button>
      {error ? (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      ) : (
        <p className="mt-2 text-xs text-zinc-600">
          Update payment method, view invoices, or cancel in the Stripe customer
          portal.
        </p>
      )}
    </div>
  );
}

export function DownloadBofBotCta() {
  return <BofBotInstallerDownloadDashboard />;
}
