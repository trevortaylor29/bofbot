import { handleStripeWebhook } from "@/lib/stripe-webhook";

export const dynamic = "force-dynamic";

/**
 * Stripe Dashboard webhook URL: `/api/billing/webhook`
 * Set `STRIPE_WEBHOOK_SECRET` to the endpoint’s signing secret (`whsec_...`).
 */
export async function POST(request: Request) {
  return handleStripeWebhook(request);
}
