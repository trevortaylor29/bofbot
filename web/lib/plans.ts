/** Billing tiers — single source for pricing UI and usage limits. */

/** Active product tiers. `basic` may still exist on legacy DB rows. */
export type UserPlan = "free" | "starter" | "pro" | "basic";

export const FREE_PLAN_WATERMARK = "bofbot.com";

export type PlanDefinition = {
  id: "free" | "starter" | "pro";
  name: string;
  priceLabel: string;
  /** List / MSRP price for promos (shown struck through next to `priceLabel`). */
  priceCompareAt?: string;
  /** Short badge above price on marketing & dashboard (e.g. launch sale). */
  pricePromoBadge?: string;
  /** Daily cap; `null` = unlimited */
  videosPerDay: number | null;
  /** Shown on free outputs; null = no watermark */
  watermark: string | null;
  priorityProcessing: boolean;
};

export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    priceLabel: "$0",
    videosPerDay: 3,
    watermark: FREE_PLAN_WATERMARK,
    priorityProcessing: false,
  },
  {
    id: "starter",
    name: "Starter",
    priceLabel: "$19/mo",
    videosPerDay: 25,
    watermark: null,
    priorityProcessing: false,
  },
  {
    id: "pro",
    name: "Pro",
    priceLabel: "$39.99/mo",
    priceCompareAt: "$69/mo",
    pricePromoBadge: "LAUNCH SALE — 43% OFF",
    videosPerDay: null,
    watermark: null,
    priorityProcessing: true,
  },
];

const planById = new Map(PLANS.map((p) => [p.id, p]));

function planIdForLookup(plan: UserPlan): PlanDefinition["id"] {
  if (plan === "basic") return "starter";
  return plan;
}

export function planDefinition(plan: UserPlan): PlanDefinition {
  return planById.get(planIdForLookup(plan)) ?? PLANS[0]!;
}

/** Text to send to the worker; burned into overlay PNG (Pillow); null = skip */
export function watermarkTextForPlan(plan: UserPlan): string | null {
  return planDefinition(plan).watermark;
}

/** `null` means no daily cap (Pro / unlimited). */
export function dailyVideoLimit(plan: UserPlan): number | null {
  return planDefinition(plan).videosPerDay;
}

export function hasPriorityProcessing(plan: UserPlan): boolean {
  return planDefinition(plan).priorityProcessing;
}

/** Normalized plan id for APIs (`basic` → `starter`). */
export function apiPlanId(plan: UserPlan): "free" | "starter" | "pro" {
  return planIdForLookup(plan);
}

/** Limits returned by `/api/user/plan` (matches product contract). */
export type PlanLimitsApi = {
  maxVideosPerDay: number;
  maxCustomHooks: number;
  watermark: boolean;
  priorityProcessing: boolean;
};

export function planLimitsForApi(plan: UserPlan): PlanLimitsApi {
  const id = planIdForLookup(plan);
  if (id === "pro") {
    return {
      maxVideosPerDay: -1,
      maxCustomHooks: -1,
      watermark: false,
      priorityProcessing: true,
    };
  }
  if (id === "starter") {
    return {
      maxVideosPerDay: 25,
      maxCustomHooks: 5,
      watermark: false,
      priorityProcessing: false,
    };
  }
  return {
    maxVideosPerDay: 3,
    maxCustomHooks: 0,
    watermark: true,
    priorityProcessing: false,
  };
}
