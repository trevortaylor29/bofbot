import type { HooksSnapshot } from "@/drizzle/schema";

/** Paths are relative to BOFBOT_MEDIA_ROOT / TIKTOKED_MEDIA_ROOT on the worker. */
export type WorkerProcessBody = {
  video_rel_path: string;
  processed_rel_path: string;
  overlay_style: "banner" | "fulltext";
  banner_hooks?: { line1_text: string; line2_text: string }[];
  fulltext_hooks?: { text: string }[];
  watermark_text?: string;
  priority_processing?: boolean;
};

export type WorkerProcessOptions = {
  watermarkText?: string | null;
  priorityProcessing?: boolean;
};

export function buildLocalWorkerPayload(
  rawRelPath: string,
  processedRelPath: string,
  snapshot: HooksSnapshot,
  options?: WorkerProcessOptions
): WorkerProcessBody {
  const base: WorkerProcessBody =
    snapshot.style === "banner"
      ? {
          video_rel_path: rawRelPath,
          processed_rel_path: processedRelPath,
          overlay_style: "banner",
          banner_hooks: snapshot.variants.map((v) => ({
            line1_text: v.line1Text,
            line2_text: v.line2Text,
          })),
        }
      : {
          video_rel_path: rawRelPath,
          processed_rel_path: processedRelPath,
          overlay_style: "fulltext",
          fulltext_hooks: snapshot.variants.map((v) => ({ text: v.text })),
        };

  const wt = options?.watermarkText?.trim();
  if (wt) base.watermark_text = wt;
  if (options?.priorityProcessing) base.priority_processing = true;
  return base;
}

export async function callProcessingWorker(
  body: WorkerProcessBody
): Promise<{ ok: boolean; status: number; detail?: string }> {
  const base = process.env.WORKER_URL?.trim().replace(/\/$/, "");
  if (!base) {
    return { ok: false, status: 0, detail: "WORKER_URL not set" };
  }
  const url = `${base}/process`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const key = process.env.WORKER_API_KEY?.trim();
  if (key) {
    headers.Authorization = `Bearer ${key}`;
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, status: res.status, detail: t.slice(0, 500) };
  }
  return { ok: true, status: res.status };
}
