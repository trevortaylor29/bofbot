import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isCheckoutPaidPlan } from "@/lib/checkout-plans";
import { rateLimit } from "@/lib/rate-limit";
import { createStripeCheckoutUrlForUser } from "@/lib/stripe-checkout-session";
import { rateLimitResponse } from "@/lib/too-many-requests";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 10;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`checkout:${session.user.id}`, MAX_PER_HOUR, WINDOW_MS);
  if (!rl.ok) return rateLimitResponse(rl);

  let body: { plan?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const planRaw = body.plan;
  if (!planRaw || !isCheckoutPaidPlan(planRaw)) {
    return NextResponse.json(
      { error: "plan must be starter or pro" },
      { status: 400 }
    );
  }

  // Session: `allow_promotion_codes` + optional `discounts` from `bofbot_ref` — see `createStripeCheckoutUrlForUser`.
  const result = await createStripeCheckoutUrlForUser(
    request,
    { id: session.user.id, email: session.user.email },
    planRaw
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ url: result.url });
}
