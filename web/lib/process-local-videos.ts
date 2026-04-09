import type { HooksSnapshot } from "@/drizzle/schema";
import { fileExistsRel, outRelPath } from "@/lib/local-media";
import {
  buildLocalWorkerPayload,
  callProcessingWorker,
  type WorkerProcessOptions,
} from "@/lib/worker";

export type LocalVideoResult = {
  videoId: string;
  rawRelPath: string;
  processedRelPath?: string;
  ok: boolean;
  detail?: string;
};

export type VideoProgressInfo = {
  index: number;
  total: number;
  result: LocalVideoResult;
  durationMs: number;
};

function extFromRel(p: string): ".mp4" | ".mov" {
  return p.toLowerCase().endsWith(".mov") ? ".mov" : ".mp4";
}

/**
 * Run Python worker for each raw file on disk (paths under LOCAL_MEDIA_ROOT).
 */
export async function processVideosLocal(params: {
  batchId: string;
  snapshot: HooksSnapshot;
  videos: { videoId: string; rawRelPath: string }[];
  workerOptions?: WorkerProcessOptions;
  /** Fires after each video finishes (success or failure), for progress / ETA. */
  onVideoDone?: (info: VideoProgressInfo) => void;
}): Promise<{ results: LocalVideoResult[] }> {
  const { batchId, snapshot, videos, workerOptions, onVideoDone } = params;
  const results: LocalVideoResult[] = [];
  const total = videos.length;

  for (let i = 0; i < videos.length; i++) {
    const v = videos[i]!;
    const t0 = Date.now();
    let result: LocalVideoResult;

    if (!fileExistsRel(v.rawRelPath)) {
      result = {
        videoId: v.videoId,
        rawRelPath: v.rawRelPath,
        ok: false,
        detail: "raw file missing — finish upload first",
      };
    } else {
      const ext = extFromRel(v.rawRelPath);
      const processedRel = outRelPath(batchId, v.videoId, ext);
      const payload = buildLocalWorkerPayload(
        v.rawRelPath,
        processedRel,
        snapshot,
        workerOptions
      );
      const wr = await callProcessingWorker(payload);
      if (wr.ok) {
        result = {
          videoId: v.videoId,
          rawRelPath: v.rawRelPath,
          processedRelPath: processedRel,
          ok: true,
        };
      } else {
        result = {
          videoId: v.videoId,
          rawRelPath: v.rawRelPath,
          ok: false,
          detail: wr.detail ?? `worker HTTP ${wr.status}`,
        };
      }
    }

    const durationMs = Date.now() - t0;
    results.push(result);
    onVideoDone?.({ index: i, total, result, durationMs });
  }

  return { results };
}
