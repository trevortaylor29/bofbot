import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isCheckoutPaidPlan } from "@/lib/checkout-plans";
import { createStripeCheckoutUrlForUser } from "@/lib/stripe-checkout-session";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
