import { eq } from "drizzle-orm";
import Link from "next/link";

import { auth } from "@/auth";
import { users } from "@/drizzle/schema";
import { db, isDatabaseConfigured } from "@/lib/db";
import { isDbConnectionError } from "@/lib/db-errors";
import { dailyVideoLimit, planDefinition, type UserPlan } from "@/lib/plans";

import { BillingPortalButton, DownloadBofBotCta } from "./dashboard-account";

function limitLabel(limit: number | null): string {
  if (limit == null) return "Unlimited per day";
  return `Up to ${limit} videos per day`;
}

export default async function DashboardPage() {
  const session = await auth();

  let dbUnavailable: string | null = null;
  let userRow: typeof users.$inferSelect | null = null;

  if (!isDatabaseConfigured()) {
    dbUnavailable =
      "The database is not configured on the server. Contact support if this persists.";
  } else if (!session?.user?.id) {
    dbUnavailable = "You must be signed in to view your account.";
  } else {
    try {
      const row = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
      });
      userRow = row ?? null;
      if (!userRow) {
        dbUnavailable = "User record not found. Try signing out and back in.";
      }
    } catch (e) {
      console.error("[dashboard] user query failed", e);
      if (isDbConnectionError(e)) {
        dbUnavailable =
          "Cannot reach the database. The server logs may have more detail.";
      } else {
        dbUnavailable =
          "Could not load your account. Check the terminal for errors.";
      }
    }
  }

  if (dbUnavailable) {
    return (
      <div className="mx-auto max-w-lg px-6 py-8">
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <p className="mt-6 rounded-lg border border-amber-900/80 bg-amber-950/40 px-4 py-3 text-sm text-amber-100/95">
          {dbUnavailable}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-400"
          >
            Log in
          </Link>
          <Link
            href="/"
            className="rounded-lg px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300"
          >
            ← Home
          </Link>
        </div>
      </div>
    );
  }

  const plan = userRow!.plan as UserPlan;
  const def = planDefinition(plan);
  const limit = dailyVideoLimit(plan);
  const used = userRow!.videosProcessedThisPeriod;

  return (
    <div className="mx-auto max-w-lg px-6 py-8">
      <h1 className="text-xl font-semibold text-white">Dashboard</h1>

      <p className="mt-6 text-sm text-zinc-400">
        Signed in as{" "}
        <span className="text-zinc-200">{session!.user!.email}</span>
      </p>

      <section className="mt-10 space-y-6">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Current plan
          </h2>
          <p className="mt-2 font-display text-2xl font-semibold text-white">
            {def.name}
          </p>
          <p className="mt-1 text-sm text-zinc-500">{def.priceLabel}</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Video usage
          </h2>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-white">
            {used}
            <span className="text-lg font-normal text-zinc-500">
              {" "}
              processed this billing period
            </span>
          </p>
          <p className="mt-3 text-sm text-zinc-400">{limitLabel(limit)}</p>
          <p className="mt-2 text-xs text-zinc-600">
            Counts reset with your billing cycle. Processing runs in the desktop
            app — nothing is uploaded from this website.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Desktop app
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Batch editing and rendering happen in BofBot for Mac and Windows.
          </p>
          <div className="mt-4">
            <DownloadBofBotCta />
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Subscription
          </h2>
          <div className="mt-4">
            <BillingPortalButton
              hasStripeCustomer={Boolean(userRow!.stripeCustomerId)}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
