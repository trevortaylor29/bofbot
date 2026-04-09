import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { scheduleBatchProcess } from "@/lib/batch-process-state";
import { parseHooksSnapshot } from "@/lib/batch-validation";
import { users } from "@/drizzle/schema";
import {
  hasPriorityProcessing,
  watermarkTextForPlan,
  type UserPlan,
} from "@/lib/plans";
import type { WorkerProcessOptions } from "@/lib/worker";

async function workerOptionsForRequest(): Promise<WorkerProcessOptions> {
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user?.id || !process.env.DATABASE_URL?.trim()) {
    return {
      watermarkText: watermarkTextForPlan("free"),
      priorityProcessing: false,
    };
  }
  try {
    const { db } = await import("@/lib/db");
    const row = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });
    const plan = (row?.plan as UserPlan) ?? "free";
    return {
      watermarkText: watermarkTextForPlan(plan),
      priorityProcessing: hasPriorityProcessing(plan),
    };
  } catch {
    return {
      watermarkText: watermarkTextForPlan("free"),
      priorityProcessing: false,
    };
  }
}

type ProcessBody = {
  batchId?: string;
  overlayStyle?: string;
  hooks?: unknown;
  videos?: { videoId?: string; rawRelPath?: string }[];
};

export async function POST(request: Request) {
  if (!process.env.WORKER_URL?.trim()) {
    return NextResponse.json(
      {
        error:
          "Processing worker is not configured. Set WORKER_URL (and optional WORKER_API_KEY) on the server.",
      },
      { status: 503 }
    );
  }

  let body: ProcessBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const batchId = body.batchId?.trim();
  if (!batchId) {
    return NextResponse.json({ error: "batchId is required" }, { status: 400 });
  }

  const overlayStyle = body.overlayStyle;
  if (overlayStyle !== "banner" && overlayStyle !== "fulltext") {
    return NextResponse.json(
      { error: "overlayStyle must be banner or fulltext" },
      { status: 400 }
    );
  }

  const hooksParsed = parseHooksSnapshot(overlayStyle, body.hooks);
  if (!hooksParsed.ok) {
    return NextResponse.json({ error: hooksParsed.error }, { status: 400 });
  }

  const rawVideos = body.videos;
  if (!Array.isArray(rawVideos) || rawVideos.length === 0) {
    return NextResponse.json(
      { error: "videos must be a non-empty array of { videoId, rawRelPath }" },
      { status: 400 }
    );
  }

  const videos: { videoId: string; rawRelPath: string }[] = [];
  for (const v of rawVideos) {
    const videoId = v?.videoId?.trim();
    const rawRelPath = v?.rawRelPath?.trim().replace(/\\/g, "/");
    if (!videoId || !rawRelPath) {
      return NextResponse.json(
        { error: "Each video needs videoId and rawRelPath" },
        { status: 400 }
      );
    }
    videos.push({ videoId, rawRelPath });
  }

  const origin =
    request.headers.get("x-forwarded-host") && request.headers.get("x-forwarded-proto")
      ? `${request.headers.get("x-forwarded-proto")}://${request.headers.get("x-forwarded-host")}`
      : new URL(request.url).origin;

  const workerOptions = await workerOptionsForRequest();
  const scheduled = scheduleBatchProcess({
    batchId,
    snapshot: hooksParsed.snapshot,
    videos,
    origin,
    workerOptions,
  });

  if (!scheduled.ok) {
    return NextResponse.json(
      { error: "This batch is already processing. Wait for it to finish." },
      { status: 409 }
    );
  }

  return NextResponse.json(
    {
      accepted: true,
      batchId,
      total: videos.length,
      pollUrl: `/api/batches/${encodeURIComponent(batchId)}/process-status`,
    },
    { status: 202 }
  );
}
