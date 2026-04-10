import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isCheckoutPaidPlan } from "@/lib/checkout-plans";
import { rateLimit } from "@/lib/rate-limit";
import { createStripeCheckoutUrlForUser } from "@/lib/stripe-checkout-session";
import { rateLimitResponse } from "@/lib/too-many-requests";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 10;

/**
 * Browser navigates here (top-level GET) so we return a 302 to Stripe.
 * Avoids client `fetch("/api/checkout")`, which was corrupting Auth.js session cookies.
 */
export async function GET(request: Request) {
  const session = await auth();
  const { searchParams } = new URL(request.url);
  const plan = searchParams.get("plan");

  if (!plan || !isCheckoutPaidPlan(plan)) {
    return NextResponse.redirect(new URL("/#pricing", request.url));
  }

  if (!session?.user?.id || !session.user.email) {
    const login = new URL("/login", request.url);
    const resume = new URL(request.url);
    login.searchParams.set("callbackUrl", `${resume.pathname}${resume.search}`);
    return NextResponse.redirect(login);
  }

  const rl = rateLimit(`checkout:${session.user.id}`, MAX_PER_HOUR, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.redirect(
      new URL("/?checkout=rate_limited#pricing", request.url)
    );
  }

  const result = await createStripeCheckoutUrlForUser(
    request,
    { id: session.user.id, email: session.user.email },
    plan
  );

  if (!result.ok) {
    return NextResponse.redirect(
      new URL("/?checkout=error#pricing", request.url)
    );
  }

  return NextResponse.redirect(result.url);
}
