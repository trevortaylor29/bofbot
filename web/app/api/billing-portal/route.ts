import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { users } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { getStripeOptional } from "@/lib/stripe";

function appOrigin(request: Request): string {
  const env =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    "";
  if (env) return env.replace(/\/$/, "");
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}`;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripeOptional();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 }
    );
  }

  const row = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });
  if (!row?.stripeCustomerId) {
    return NextResponse.json(
      {
        error:
          "No billing account yet. Subscribe from the home page pricing section first, then you can manage your subscription here.",
      },
      { status: 400 }
    );
  }

  const origin = appOrigin(request);
  const portal = await stripe.billingPortal.sessions.create({
    customer: row.stripeCustomerId,
    return_url: `${origin}/dashboard`,
  });

  if (!portal.url) {
    return NextResponse.json(
      { error: "Stripe did not return a portal URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: portal.url });
}
