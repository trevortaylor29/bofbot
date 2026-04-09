import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { users } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { dailyVideoLimit, type UserPlan } from "@/lib/plans";
import {
  effectiveVideosProcessedToday,
  isSameUtcUsageDay,
  utcUsageDate,
} from "@/lib/user-daily-usage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let amount = 1;
  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body.amount === "number" && Number.isFinite(body.amount)) {
      amount = Math.floor(body.amount);
    }
  } catch {
    amount = 1;
  }
  if (amount < 1) {
    return NextResponse.json(
      { error: "amount must be at least 1" },
      { status: 400 }
    );
  }
  if (amount > 500) {
    return NextResponse.json(
      { error: "amount too large" },
      { status: 400 }
    );
  }

  const userId = session.user.id;

  try {
    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .for("update");

      if (!row) {
        return { type: "not_found" as const };
      }

      const plan = row.plan as UserPlan;
      const today = utcUsageDate();
      let count = effectiveVideosProcessedToday(
        row.usageDay ?? undefined,
        row.videosProcessedToday
      );

      if (!isSameUtcUsageDay(row.usageDay ?? undefined, today)) {
        count = 0;
      }

      const max = dailyVideoLimit(plan);
      if (max !== null && count >= max) {
        return {
          type: "ok" as const,
          videosProcessedToday: count,
          atLimit: true,
        };
      }

      if (max !== null && count + amount > max) {
        return {
          type: "reject" as const,
          videosProcessedToday: count,
          max,
        };
      }

      const newCount = count + amount;
      await tx
        .update(users)
        .set({
          videosProcessedToday: newCount,
          usageDay: today,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      const atLimit = max !== null && newCount >= max;
      return {
        type: "ok" as const,
        videosProcessedToday: newCount,
        atLimit,
      };
    });

    if (result.type === "not_found") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (result.type === "reject") {
      return NextResponse.json(
        {
          error: "Would exceed daily limit",
          videosProcessedToday: result.videosProcessedToday,
          atLimit: true,
          dailyLimit: result.max,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      videosProcessedToday: result.videosProcessedToday,
      atLimit: result.atLimit,
    });
  } catch (e) {
    console.error("[increment-usage]", e);
    return NextResponse.json(
      { error: "Failed to update usage" },
      { status: 500 }
    );
  }
}
