import Link from "next/link";

import { PLANS } from "@/lib/plans";

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-zinc-500 hover:text-white">
        ← Home
      </Link>
      <h1 className="mt-8 text-3xl font-semibold text-white">Pricing</h1>
      <p className="mt-2 text-zinc-400">
        BofBot plans (Stripe checkout will connect here later).
      </p>
      <ul className="mt-10 space-y-6 text-zinc-300">
        {PLANS.map((p) => (
          <li
            key={p.id}
            className="rounded-xl border border-zinc-800 p-6"
          >
            <h2 className="font-medium text-white">
              {p.name}
              {p.id !== "free" ? ` — ${p.priceLabel}` : ""}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              {p.videosPerDay} videos / day
              {p.watermark
                ? ` · watermark (${p.watermark})`
                : " · no watermark"}
              {p.priorityProcessing ? " · priority processing" : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
