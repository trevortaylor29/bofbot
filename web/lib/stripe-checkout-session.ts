import "server-only";

import { eq } from "drizzle-orm";
import Stripe from "stripe";

import { users } from "@/drizzle/schema";
import {
  affiliateRefStripeLookupVariants,
  parseAffiliateRefFromCookieHeader,
} from "@/lib/affiliate-ref";
import {
  resolveStripePriceForCheckout,
  type CheckoutPaidPlan,
} from "@/lib/checkout-plans";
import { db } from "@/lib/db";
import { getStripeOptional } from "@/lib/stripe";

/**
 * Resolves a customer-facing promotion code string to a Stripe promotion_code id
 * for Checkout `discounts`. Tries case variants because Stripe stores codes as configured.
 */
async function resolvePromotionCodeId(
  stripe: Stripe,
  ref: string
): Promise<string | null> {
  for (const code of affiliateRefStripeLookupVariants(ref)) {
    try {
      const list = await stripe.promotionCodes.list({
        code,
        active: true,
        limit: 1,
      });
      const first = list.data[0];
      if (first?.id) return first.id;
    } catch (e) {
      console.warn(
        "[checkout] promotionCodes.list failed for code variant",
        code,
        e
      );
    }
  }
  return null;
}

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
      error: "Checkout is not available. Please try again later.",
    };
  }

  const stripe = getStripeOptional();
  if (!stripe) {
    return {
      ok: false,
      status: 503,
      error: "Checkout is not available. Please try again later.",
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

  const affiliateRef = parseAffiliateRefFromCookieHeader(
    request.headers.get("cookie")
  );
  let promotionCodeId: string | null = null;
  if (affiliateRef) {
    promotionCodeId = await resolvePromotionCodeId(stripe, affiliateRef);
    if (!promotionCodeId) {
      console.log("[checkout] no active Stripe promotion code for affiliate ref", {
        affiliateRef,
      });
    }
  }

  const sessionMetadata: Record<string, string> = {
    userId: sessionUser.id,
    plan: planRaw,
  };
  if (affiliateRef) {
    sessionMetadata.affiliate_ref = affiliateRef;
    sessionMetadata.affiliate_applied = promotionCodeId
      ? "promotion_code"
      : "none";
  }

  const subscriptionMetadata: Record<string, string> = {
    userId: sessionUser.id,
    plan: planRaw,
  };
  if (promotionCodeId && affiliateRef) {
    subscriptionMetadata.affiliate_ref = affiliateRef;
  }

  try {
    /** Promo field on Checkout; `bofbot_ref` cookie → `discounts` when Stripe finds an active matching promotion code. */
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: sessionUser.id,
      customer: userRow.stripeCustomerId ?? undefined,
      customer_email: userRow.stripeCustomerId ? undefined : sessionUser.email,
      allow_promotion_codes: true,
      ...(promotionCodeId
        ? { discounts: [{ promotion_code: promotionCodeId }] }
        : {}),
      metadata: sessionMetadata,
      subscription_data: {
        metadata: subscriptionMetadata,
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
