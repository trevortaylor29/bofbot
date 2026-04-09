import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getActorUserId } from "@/lib/actor-user";
import { batches } from "@/drizzle/schema";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const userId = await getActorUserId();
  const { batchId } = await params;

  const batch = await db.query.batches.findFirst({
    where: and(eq(batches.id, batchId), eq(batches.userId, userId)),
    with: { videos: true },
  });

  if (!batch) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ batch });
}
