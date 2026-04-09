import { eq } from "drizzle-orm";
import Stripe from "stripe";

import { users } from "@/drizzle/schema";
import {
  resolveStripePriceForCheckout,
  type CheckoutPaidPlan,
} from "@/lib/checkout-plans";
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

export type StripeCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; status: number; error: string };

/**
 * Creates a Stripe Checkout session URL for a logged-in user.
 * Used by JSON POST and by GET redirect (browser navigation — avoids fetch + cookie edge cases).
 */
export async function createStripeCheckoutUrlForUser(
  request: Request,
  sessionUser: { id: string; email: string },
  planRaw: CheckoutPaidPlan
): Promise<StripeCheckoutResult> {
  const resolved = resolveStripePriceForCheckout(planRaw);
  const { priceId, envVarName, diagnostics } = resolved;

  console.log("[checkout]", {
    plan: planRaw,
    envVar: envVarName,
    priceId: priceId ?? "(null)",
    diagnostics,
  });

  if (!priceId) {
    return {
      ok: false,
      status: 503,
      error: `Invalid Stripe price for ${planRaw}. Set ${envVarName} to a valid price id. ${diagnostics}`,
    };
  }

  const stripe = getStripeOptional();
  if (!stripe) {
    return {
      ok: false,
      status: 503,
      error: "STRIPE_SECRET_KEY is not set",
    };
  }

  const userRow = await db.query.users.findFirst({
    where: eq(users.id, sessionUser.id),
  });
  if (!userRow) {
    return { ok: false, status: 404, error: "User not found" };
  }

  const origin = appOrigin(request);
  const successUrl = `${origin}/dashboard?checkout=success`;
  const cancelUrl = `${origin}/?checkout=cancel#pricing`;

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: sessionUser.id,
      customer: userRow.stripeCustomerId ?? undefined,
      customer_email: userRow.stripeCustomerId ? undefined : sessionUser.email,
      metadata: {
        userId: sessionUser.id,
        plan: planRaw,
      },
      subscription_data: {
        metadata: {
          userId: sessionUser.id,
          plan: planRaw,
        },
      },
    });

    if (!checkoutSession.url) {
      console.error("[checkout] Stripe returned no URL", { plan: planRaw, priceId });
      return {
        ok: false,
        status: 500,
        error: "Stripe did not return a checkout URL",
      };
    }

    return { ok: true, url: checkoutSession.url };
  } catch (e: unknown) {
    const stripeErr = e instanceof Stripe.errors.StripeError ? e : null;
    const msg = stripeErr?.message ?? (e instanceof Error ? e.message : String(e));

    const stripeLogPayload = {
      plan: planRaw,
      envVar: envVarName,
      priceId,
      message: msg,
      type: stripeErr?.type,
      code: stripeErr?.code,
      decline_code: stripeErr?.decline_code,
      param: stripeErr?.param,
      statusCode: stripeErr?.statusCode,
      requestId: stripeErr?.requestId,
      raw: stripeErr?.raw ?? null,
    };
    console.error("[checkout] Stripe API error (exact message):", msg);
    console.error("[checkout] Stripe error object:", stripeLogPayload);
    console.error(
      "[checkout] COPY_PASTE_JSON",
      JSON.stringify(
        {
          plan: planRaw,
          envVar: envVarName,
          priceId,
          message: msg,
          type: stripeErr?.type,
          code: stripeErr?.code,
          decline_code: stripeErr?.decline_code,
          param: stripeErr?.param,
          statusCode: stripeErr?.statusCode,
          requestId: stripeErr?.requestId,
        },
        null,
        2
      )
    );
    if (e instanceof Error && e.stack) {
      console.error("[checkout] Stack:", e.stack);
    }

    return {
      ok: false,
      status: 502,
      error:
        "Checkout could not be started. See server logs for the Stripe error (often wrong price ID, archived price, or account mismatch).",
    };
  }
}
