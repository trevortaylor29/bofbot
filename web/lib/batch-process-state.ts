import type { HooksSnapshot } from "@/drizzle/schema";
import { processVideosLocal } from "@/lib/process-local-videos";
import {
  isR2DirectUploadConfigured,
  normalizeR2ObjectKey,
  presignGetDownload,
} from "@/lib/r2-upload";
import type { WorkerProcessOptions } from "@/lib/worker";

/**
 * In-memory batch processing progress for async POST /api/process + polling.
 * Uses globalThis so all route bundles share state (same pattern as pending batches).
 */
export type BatchProcessStatus = {
  batchId: string;
  total: number;
  /** Videos finished (success or failure). */
  finished: number;
  succeeded: number;
  failed: number;
  done: boolean;
  /** True when every video succeeded. */
  complete: boolean;
  fatalError?: string;
  downloads: { videoId: string; url: string }[];
  errors: string[];
  /** Seconds remaining; null until at least one video has finished. */
  etaSeconds: number | null;
  startedAt: number;
};

type InternalEntry = {
  batchId: string;
  total: number;
  finished: number;
  succeeded: number;
  failed: number;
  done: boolean;
  complete: boolean;
  fatalError?: string;
  downloads: { videoId: string; url: string }[];
  errors: string[];
  videoDurationsMs: number[];
  startedAt: number;
  running: boolean;
};

const g = globalThis as typeof globalThis & {
  __bofbotBatchProcess?: Map<string, InternalEntry>;
};

const store = g.__bofbotBatchProcess ?? new Map<string, InternalEntry>();
g.__bofbotBatchProcess = store;

function etaSecondsFromEntry(e: InternalEntry): number | null {
  if (e.done || e.finished >= e.total) return 0;
  if (e.finished === 0 || e.videoDurationsMs.length === 0) return null;
  const sum = e.videoDurationsMs.reduce((a, b) => a + b, 0);
  const avg = sum / e.videoDurationsMs.length;
  const remaining = e.total - e.finished;
  return Math.max(0, Math.ceil((avg * remaining) / 1000));
}

function toPublic(e: InternalEntry): BatchProcessStatus {
  return {
    batchId: e.batchId,
    total: e.total,
    finished: e.finished,
    succeeded: e.succeeded,
    failed: e.failed,
    done: e.done,
    complete: e.complete,
    fatalError: e.fatalError,
    downloads: [...e.downloads],
    errors: [...e.errors],
    etaSeconds: e.done ? 0 : etaSecondsFromEntry(e),
    startedAt: e.startedAt,
  };
}

export function getBatchProcessStatus(
  batchId: string
): BatchProcessStatus | null {
  const e = store.get(batchId);
  return e ? toPublic(e) : null;
}

function isActivelyRunning(e: InternalEntry): boolean {
  return e.running && !e.done;
}

export function scheduleBatchProcess(params: {
  batchId: string;
  snapshot: HooksSnapshot;
  videos: { videoId: string; rawRelPath: string }[];
  origin: string;
  workerOptions?: WorkerProcessOptions;
}): { ok: true } | { ok: false; reason: "already_running" } {
  const { batchId, snapshot, videos, origin, workerOptions } = params;
  const existing = store.get(batchId);
  if (existing && isActivelyRunning(existing)) {
    return { ok: false, reason: "already_running" };
  }

  const entry: InternalEntry = {
    batchId,
    total: videos.length,
    finished: 0,
    succeeded: 0,
    failed: 0,
    done: false,
    complete: false,
    downloads: [],
    errors: [],
    videoDurationsMs: [],
    startedAt: Date.now(),
    running: true,
  };
  store.set(batchId, entry);

  void runBatch(entry.batchId, snapshot, videos, origin, workerOptions);
  return { ok: true };
}

async function runBatch(
  batchId: string,
  snapshot: HooksSnapshot,
  videos: { videoId: string; rawRelPath: string }[],
  origin: string,
  workerOptions?: WorkerProcessOptions
): Promise<void> {
  try {
    await processVideosLocal({
      batchId,
      snapshot,
      videos,
      workerOptions,
      onVideoDone: async ({ result, durationMs }) => {
        const e = store.get(batchId);
        if (!e) return;
        e.finished += 1;
        e.videoDurationsMs.push(durationMs);
        if (result.ok) {
          e.succeeded += 1;
        } else {
          e.failed += 1;
          e.errors.push(`${result.videoId}: ${result.detail ?? "failed"}`);
        }
        if (result.ok && result.processedRelPath) {
          const base = result.processedRelPath.split("/").pop() ?? "";
          try {
            let url: string;
            if (isR2DirectUploadConfigured()) {
              const key = normalizeR2ObjectKey(result.processedRelPath);
              if (!key) {
                throw new Error("invalid processed key for R2");
              }
              url = await presignGetDownload(key, base || "video.mp4");
            } else {
              const encBatch = encodeURIComponent(batchId);
              const encFile = encodeURIComponent(base);
              url = `${origin}/api/download-local/${encBatch}/${encFile}`;
            }
            e.downloads.push({
              videoId: result.videoId,
              url,
            });
          } catch (err) {
            console.error("[bofbot] download URL failed", err);
            e.succeeded -= 1;
            e.failed += 1;
            e.errors.push(
              `${result.videoId}: could not create download link`
            );
          }
        }
      },
    });

    const e = store.get(batchId);
    if (!e) return;
    e.done = true;
    e.running = false;
    e.complete = e.failed === 0 && e.succeeded === e.total;
  } catch (err) {
    const e = store.get(batchId);
    if (e) {
      e.done = true;
      e.running = false;
      e.fatalError =
        err instanceof Error ? err.message : "Processing failed";
    }
  }
}
