/**
 * Optional BullMQ worker: DB-backed batches (processSingleVideo reads Postgres).
 * The main upload flow uses POST /api/process + process-status polling instead.
 *
 * Run from `web/`: npm run worker:video
 * Requires: REDIS_URL, DATABASE_URL, WORKER_URL, and shared media paths on disk.
 */
import { config } from "dotenv";
import { resolve } from "path";
import { Worker } from "bullmq";
import IORedis from "ioredis";

import type { VideoJobData } from "../lib/queue";
import { processSingleVideo, tryFinalizeBatch } from "../lib/process-video";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const url = process.env.REDIS_URL?.trim();
if (!url) {
  console.error("REDIS_URL is required");
  process.exit(1);
}

const connection = new IORedis(url, { maxRetriesPerRequest: null });

const worker = new Worker<VideoJobData>(
  "video-process",
  async (job) => {
    const { batchId, videoId, userId } = job.data;
    await processSingleVideo({ batchId, videoId, userId });
    await tryFinalizeBatch(batchId);
  },
  { connection, concurrency: 2 }
);

worker.on("failed", (job, err) => {
  console.error("Job failed", job?.id, err);
});

worker.on("completed", (job) => {
  console.info("Job ok", job.id);
});

console.info("video-process worker started (concurrency 2)");
