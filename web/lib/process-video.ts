import { and, eq } from "drizzle-orm";

import { batches, users, videos } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { fileExistsRel, outRelPath } from "@/lib/local-media";
import {
  hasPriorityProcessing,
  watermarkTextForPlan,
  type UserPlan,
} from "@/lib/plans";
import { buildLocalWorkerPayload, callProcessingWorker } from "@/lib/worker";

function outputExtFromRawPath(rawPath: string): ".mp4" | ".mov" {
  return rawPath.toLowerCase().endsWith(".mov") ? ".mov" : ".mp4";
}

export async function tryFinalizeBatch(batchId: string): Promise<void> {
  const vids = await db.query.videos.findMany({
    where: eq(videos.batchId, batchId),
  });
  if (vids.length === 0) return;
  const allSettled = vids.every(
    (v) => v.status === "complete" || v.status === "failed"
  );
  if (!allSettled) return;
  const okCount = vids.filter((v) => v.status === "complete").length;
  await db
    .update(batches)
    .set({
      status: okCount === vids.length ? "complete" : "failed",
      processedVideos: okCount,
      completedAt: new Date(),
    })
    .where(eq(batches.id, batchId));
}

export async function processSingleVideo(params: {
  batchId: string;
  videoId: string;
  userId: string;
}): Promise<{ ok: boolean; detail?: string }> {
  const { batchId, videoId, userId } = params;

  const batch = await db.query.batches.findFirst({
    where: and(eq(batches.id, batchId), eq(batches.userId, userId)),
  });
  if (!batch) {
    return { ok: false, detail: "batch not found" };
  }

  const video = await db.query.videos.findFirst({
    where: and(
      eq(videos.id, videoId),
      eq(videos.batchId, batchId),
      eq(videos.userId, userId)
    ),
  });
  if (!video) {
    return { ok: false, detail: "video not found" };
  }

  const relRaw = video.rawMediaPath.replace(/\\/g, "/");
  if (!fileExistsRel(relRaw)) {
    await db
      .update(videos)
      .set({ status: "failed" })
      .where(eq(videos.id, videoId));
    return { ok: false, detail: "raw file missing on disk" };
  }

  await db
    .update(videos)
    .set({ status: "processing" })
    .where(eq(videos.id, videoId));

  const ext = outputExtFromRawPath(relRaw);
  const processedRel = outRelPath(batchId, video.id, ext);

  const userRow = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  const plan = (userRow?.plan as UserPlan) ?? "free";

  const payload = buildLocalWorkerPayload(
    relRaw,
    processedRel,
    batch.hooksSnapshot,
    {
      watermarkText: watermarkTextForPlan(plan),
      priorityProcessing: hasPriorityProcessing(plan),
    }
  );

  const wr = await callProcessingWorker(payload);
  if (wr.ok) {
    await db
      .update(videos)
      .set({
        status: "complete",
        processedMediaPath: processedRel,
        processedAt: new Date(),
      })
      .where(eq(videos.id, videoId));
    return { ok: true };
  }

  await db
    .update(videos)
    .set({ status: "failed" })
    .where(eq(videos.id, videoId));
  return { ok: false, detail: wr.detail ?? String(wr.status) };
}

export async function processBatchVideosSync(
  batchId: string,
  userId: string
): Promise<{
  processed: number;
  total: number;
  complete: boolean;
  errors: string[];
}> {
  const batch = await db.query.batches.findFirst({
    where: and(eq(batches.id, batchId), eq(batches.userId, userId)),
  });
  if (!batch) {
    throw new Error("Batch not found");
  }

  const vids = await db.query.videos.findMany({
    where: eq(videos.batchId, batchId),
  });
  if (vids.length === 0) {
    throw new Error("No videos in batch");
  }

  for (const v of vids) {
    const rel = v.rawMediaPath.replace(/\\/g, "/");
    if (!fileExistsRel(rel)) {
      throw new Error(
        `Upload missing on disk for ${v.rawMediaPath}. Finish all uploads first.`
      );
    }
  }

  await db
    .update(batches)
    .set({ status: "processing" })
    .where(eq(batches.id, batchId));

  const errors: string[] = [];
  let okCount = 0;

  for (const v of vids) {
    const r = await processSingleVideo({
      batchId,
      videoId: v.id,
      userId,
    });
    if (r.ok) {
      okCount += 1;
    } else {
      errors.push(`${v.id}: ${r.detail ?? "error"}`);
    }
  }

  await tryFinalizeBatch(batchId);

  return {
    processed: okCount,
    total: vids.length,
    complete: okCount === vids.length,
    errors,
  };
}
