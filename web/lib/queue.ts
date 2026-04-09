import { Queue } from "bullmq";
import IORedis from "ioredis";

export type VideoJobData = {
  batchId: string;
  videoId: string;
  userId: string;
};

let videoQueue: Queue<VideoJobData> | null = null;

function redisConnection(): IORedis {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    throw new Error("REDIS_URL is not set");
  }
  return new IORedis(url, { maxRetriesPerRequest: null });
}

export function getVideoQueue(): Queue<VideoJobData> | null {
  if (!process.env.REDIS_URL?.trim()) {
    return null;
  }
  if (!videoQueue) {
    videoQueue = new Queue<VideoJobData>("video-process", {
      connection: redisConnection(),
    });
  }
  return videoQueue;
}

export async function enqueueBatchVideoJobs(
  batchId: string,
  userId: string,
  videoIds: string[]
): Promise<void> {
  const q = getVideoQueue();
  if (!q) {
    throw new Error("Queue unavailable");
  }
  for (const videoId of videoIds) {
    await q.add(
      "process",
      { batchId, videoId, userId },
      {
        jobId: `${batchId}:${videoId}`,
        removeOnComplete: 500,
        attempts: 2,
        backoff: { type: "exponential", delay: 8000 },
      }
    );
  }
}
