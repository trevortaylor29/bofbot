/** Billing tiers — single source for pricing UI and usage limits. */

export type UserPlan = "free" | "starter" | "basic" | "pro";

export const FREE_PLAN_WATERMARK = "bofbot.com";

export type PlanDefinition = {
  id: UserPlan;
  name: string;
  priceLabel: string;
  videosPerDay: number;
  /** Shown on free outputs; null = no watermark */
  watermark: string | null;
  priorityProcessing: boolean;
};

export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    priceLabel: "$0",
    videosPerDay: 5,
    watermark: FREE_PLAN_WATERMARK,
    priorityProcessing: false,
  },
  {
    id: "starter",
    name: "Starter",
    priceLabel: "$10/mo",
    videosPerDay: 15,
    watermark: null,
    priorityProcessing: false,
  },
  {
    id: "basic",
    name: "Basic",
    priceLabel: "$14.99/mo",
    videosPerDay: 30,
    watermark: null,
    priorityProcessing: false,
  },
  {
    id: "pro",
    name: "Pro",
    priceLabel: "$25/mo",
    videosPerDay: 125,
    watermark: null,
    priorityProcessing: true,
  },
];

const planById = new Map(PLANS.map((p) => [p.id, p]));

export function planDefinition(plan: UserPlan): PlanDefinition {
  return planById.get(plan) ?? PLANS[0]!;
}

/** Text to send to the worker for drawtext; null = skip watermark */
export function watermarkTextForPlan(plan: UserPlan): string | null {
  return planDefinition(plan).watermark;
}

export function dailyVideoLimit(plan: UserPlan): number {
  return planDefinition(plan).videosPerDay;
}

export function hasPriorityProcessing(plan: UserPlan): boolean {
  return planDefinition(plan).priorityProcessing;
}
