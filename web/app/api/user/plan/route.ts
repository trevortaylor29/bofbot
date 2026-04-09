import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { users } from "@/drizzle/schema";
import { db } from "@/lib/db";
import {
  apiPlanId,
  planLimitsForApi,
  type UserPlan,
} from "@/lib/plans";
import { effectiveVideosProcessedToday } from "@/lib/user-daily-usage";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });
  if (!row) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const plan = row.plan as UserPlan;
  const videosProcessedToday = effectiveVideosProcessedToday(
    row.usageDay ?? undefined,
    row.videosProcessedToday
  );

  return NextResponse.json({
    plan: apiPlanId(plan),
    videosProcessedToday,
    limits: planLimitsForApi(plan),
  });
}
