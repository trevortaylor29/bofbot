/**
 * Creates BofBot Starter ($19/mo) and Pro ($49/mo) products + recurring prices in Stripe (test mode).
 *
 * Usage (from `web/`):
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-seed-products.mjs
 *
 * Copy the printed STRIPE_PRICE_* lines into .env.local
 */
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key || !key.startsWith("sk_")) {
  console.error(
    "Set STRIPE_SECRET_KEY to your Stripe secret key (use sk_test_... for test mode)."
  );
  process.exit(1);
}

const stripe = new Stripe(key);

async function main() {
  const starterProduct = await stripe.products.create({
    name: "BofBot Starter",
    description: "25 videos/day, no watermark, custom hooks (up to 5)",
    metadata: { plan: "starter" },
  });

  const starterPrice = await stripe.prices.create({
    product: starterProduct.id,
    unit_amount: 1900,
    currency: "usd",
    recurring: { interval: "month" },
    metadata: { plan: "starter" },
  });

  const proProduct = await stripe.products.create({
    name: "BofBot Pro",
    description: "Unlimited videos, unlimited custom hooks, priority processing",
    metadata: { plan: "pro" },
  });

  const proPrice = await stripe.prices.create({
    product: proProduct.id,
    unit_amount: 4900,
    currency: "usd",
    recurring: { interval: "month" },
    metadata: { plan: "pro" },
  });

  console.log("\n--- Add these to .env.local ---\n");
  console.log(`STRIPE_PRICE_STARTER=${starterPrice.id}`);
  console.log(`STRIPE_PRICE_PRO=${proPrice.id}`);
  console.log("\nUse Stripe CLI to forward webhooks locally:");
  console.log(
    "  stripe listen --forward-to localhost:3000/api/webhooks/stripe"
  );
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
