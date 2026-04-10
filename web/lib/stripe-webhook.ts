import "server-only";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { users } from "@/drizzle/schema";
import { isCheckoutPaidPlan } from "@/lib/checkout-plans";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

async function setPlanForUser(
  userId: string,
  plan: "free" | "starter" | "pro"
): Promise<void> {
  await db
    .update(users)
    .set({
      plan,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

async function setStripeCustomer(userId: string, customerId: string) {
  await db
    .update(users)
    .set({
      stripeCustomerId: customerId,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

/**
 * Shared Stripe webhook POST handler. Used by `/api/webhooks/stripe` and `/api/billing/webhook`.
 */
export async function handleStripeWebhook(request: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 }
    );
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    console.error("[stripe webhook] signature verify failed", e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const userId =
          session.metadata?.userId ?? session.client_reference_id ?? undefined;
        const planRaw = session.metadata?.plan;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;

        if (!userId || !planRaw || !isCheckoutPaidPlan(planRaw)) {
          console.error(
            "[stripe webhook] checkout.session.completed missing userId/plan",
            { userId, planRaw }
          );
          break;
        }

        if (customerId) {
          await setStripeCustomer(userId, customerId);
        }
        await setPlanForUser(userId, planRaw);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        if (!userId) {
          console.error(
            "[stripe webhook] subscription.deleted missing metadata.userId"
          );
          break;
        }
        await setPlanForUser(userId, "free");
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("[stripe webhook] handler error", e);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
