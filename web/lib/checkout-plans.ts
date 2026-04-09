export type CheckoutPaidPlan = "starter" | "pro";

const PRICE_ENV: Record<CheckoutPaidPlan, string> = {
  starter: "STRIPE_PRICE_STARTER",
  pro: "STRIPE_PRICE_PRO",
};

/** Stripe recurring price IDs are `price_` + alphanumeric. */
const STRIPE_PRICE_ID_RE = /^price_[a-zA-Z0-9]+$/;

function normalizePriceIdFromEnv(raw: string | undefined): {
  id: string | null;
  diagnostics: string;
} {
  if (raw === undefined) {
    return { id: null, diagnostics: "(env var unset)" };
  }
  let s = raw.trim();
  // Strip wrapping quotes and stray BOM / whitespace (common .env copy-paste issues)
  s = s.replace(/^\uFEFF/, "");
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  if (!s) {
    return { id: null, diagnostics: "(empty after trim)" };
  }
  if (!STRIPE_PRICE_ID_RE.test(s)) {
    return {
      id: null,
      diagnostics: `invalid format (expected price_…, got length=${s.length} preview=${JSON.stringify(s.slice(0, 24))})`,
    };
  }
  return { id: s, diagnostics: "ok" };
}

export function stripePriceIdForPlan(plan: CheckoutPaidPlan): string | null {
  const envName = PRICE_ENV[plan];
  const { id } = normalizePriceIdFromEnv(process.env[envName]);
  return id;
}

/** Resolve + validate price id for checkout logging and errors. */
export function resolveStripePriceForCheckout(plan: CheckoutPaidPlan): {
  priceId: string | null;
  envVarName: string;
  diagnostics: string;
} {
  const envVarName = PRICE_ENV[plan];
  const raw = process.env[envVarName];
  const { id, diagnostics } = normalizePriceIdFromEnv(raw);
  return { priceId: id, envVarName, diagnostics };
}

export function isCheckoutPaidPlan(s: string): s is CheckoutPaidPlan {
  return s === "starter" || s === "pro";
}
