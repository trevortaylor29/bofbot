/**
 * Desktop / Electron upload + local processing UI (preserved for the native app).
 * Not mounted from any Next.js route — wire `apiBase` / routes when embedding.
 */
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

const PROCESS_POLL_MS = 3000;

const IS_DEV = process.env.NODE_ENV === "development";

function devOrProd<T>(dev: T, prod: T): T {
  return IS_DEV ? dev : prod;
}

function formatEta(seconds: number): string {
  if (seconds <= 0) return "";
  if (seconds < 60) return `About ${seconds}s remaining`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) {
    return s > 0
      ? `About ${m}m ${s}s remaining`
      : `About ${m}m remaining`;
  }
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `About ${h}h ${rm}m remaining`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

import {
  BANNER_CUSTOM_PLACEHOLDER,
  BANNER_PRESETS,
  FULLTEXT_CUSTOM_PLACEHOLDER,
  FULLTEXT_PRESETS,
  parseCustomBannerLines,
  parseCustomFulltextLines,
  type BannerPreset,
  type FulltextPreset,
} from "./hook-presets";

type OverlayStyle = "banner" | "fulltext";
type HookSource = "presets" | "custom";

const ACCEPT =
  "video/mp4,video/quicktime,video/x-m4v,.mp4,.mov,.m4v";

function isNetworkFetchFailure(e: unknown): boolean {
  // Browsers usually throw TypeError("Failed to fetch") when the connection is
  // refused, DNS fails, CORS blocks, or the request was aborted.
  if (e instanceof TypeError) {
    const m = e.message.toLowerCase();
    if (
      m.includes("failed to fetch") ||
      m.includes("fetch failed") ||
      m.includes("networkerror") ||
      m.includes("network error") ||
      m.includes("load failed") ||
      (m.includes("fetch") && m.includes("fail"))
    ) {
      return true;
    }
  }
  if (e instanceof Error) {
    const m = e.message.toLowerCase();
    return (
      m.includes("failed to fetch") ||
      m.includes("fetch failed") ||
      m.includes("networkerror") ||
      m.includes("network request failed") ||
      m.includes("load failed")
    );
  }
  return false;
}

function explainFetchError(e: unknown): string {
  if (isNetworkFetchFailure(e)) {
    return devOrProd(
      "Could not reach the Next.js server (browser reported a network error). " +
        "Wait until the Next.js window shows “Ready”, then use the same host and port " +
        "as that window (we pin dev to port 3000 — see `npm run dev` in web/package.json). " +
        "Run `npm run dev` in the web folder or double‑click start.bat at the repo root; " +
        "open http://127.0.0.1:3000/ (not a file:// page). " +
        "If port 3000 is already in use, free it or change the dev port and open the new URL. " +
        "If the server is running, check that terminal for errors and try disabling VPN/ad‑block for localhost.",
      "Could not reach the server. Check your connection and try again."
    );
  }
  if (e instanceof Error && e.cause instanceof Error) {
    return `${e.message} — ${e.cause.message}`;
  }
  return e instanceof Error ? e.message : "Something went wrong";
}

function PresetBannerMini({ p }: { p: BannerPreset }) {
  return (
    <div className="pointer-events-none flex aspect-[9/16] max-h-[140px] w-full flex-col items-stretch justify-start overflow-hidden rounded-md bg-zinc-950 p-1.5">
      <div
        className="w-full rounded-md px-1 py-0.5 text-center text-[8px] font-bold leading-tight sm:text-[9px]"
        style={{ backgroundColor: p.line1Bg, color: p.line1Fg }}
      >
        {p.line1Text}
      </div>
      <div
        className="mt-1 w-[92%] self-center rounded-md px-1 py-0.5 text-center text-[7px] font-bold leading-tight sm:text-[8px]"
        style={{ backgroundColor: p.line2Bg, color: p.line2Fg }}
      >
        {p.line2Text}
      </div>
    </div>
  );
}

function PresetFulltextMini({ p }: { p: FulltextPreset }) {
  return (
    <div className="pointer-events-none flex aspect-[9/16] max-h-[140px] w-full items-start justify-center overflow-hidden rounded-md bg-gradient-to-b from-zinc-900 to-black p-2">
      <p
        className="line-clamp-6 text-center text-[7px] font-bold leading-snug text-white sm:text-[8px]"
        style={{
          textShadow:
            "0 0 2px #000, 0 1px 0 #000, 1px 0 0 #000, -1px 0 0 #000, 0 -1px 0 #000",
        }}
      >
        {p.text}
      </p>
    </div>
  );
}

const defaultBannerPresetIds = () =>
  new Set(BANNER_PRESETS.map((b) => b.id));
const defaultFulltextPresetIds = () =>
  new Set(FULLTEXT_PRESETS.map((f) => f.id));

export function UploadFlow() {
  const router = useRouter();
  const [hookSource, setHookSource] = useState<HookSource>("presets");
  const [presetStyle, setPresetStyle] = useState<OverlayStyle>("banner");
  const [selectedBannerPresetIds, setSelectedBannerPresetIds] = useState(
    defaultBannerPresetIds
  );
  const [selectedFulltextPresetIds, setSelectedFulltextPresetIds] = useState(
    defaultFulltextPresetIds
  );

  const [customStyle, setCustomStyle] = useState<OverlayStyle>("banner");
  const [customHooksText, setCustomHooksText] = useState("");

  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<
    { videoId: string; fileName: string; url: string }[] | null
  >(null);
  /** Set when every video in the batch processed OK — enables “Download all”. */
  const [zipBatchId, setZipBatchId] = useState<string | null>(null);
  /** Shown while polling GET …/process-status after POST /api/process returns 202. */
  const [processProgress, setProcessProgress] = useState<null | {
    total: number;
    finished: number;
    etaSeconds: number | null;
  }>(null);

  const addFiles = useCallback((list: FileList | File[]): number => {
    const arr = Array.from(list);
    const next: File[] = [];
    for (const f of arr) {
      const n = f.name.toLowerCase();
      const byName =
        n.endsWith(".mp4") || n.endsWith(".mov") || n.endsWith(".m4v");
      const t = (f.type || "").toLowerCase();
      const byType =
        t === "video/mp4" ||
        t === "video/quicktime" ||
        t === "video/x-m4v";
      if (byName || byType) {
        next.push(f);
      }
    }
    if (next.length === 0) return 0;
    setFiles((prev) => [...prev, ...next]);
    return next.length;
  }, []);

  const removeFile = (i: number) => {
    setFiles((prev) => prev.filter((_, j) => j !== i));
  };

  const toggleBannerPreset = (id: string) => {
    setSelectedBannerPresetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFulltextPreset = (id: string) => {
    setSelectedFulltextPresetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  function buildHooksPayload():
    | { ok: true; overlayStyle: OverlayStyle; hooks: unknown[] }
    | { ok: false; error: string } {
    if (hookSource === "presets") {
      if (presetStyle === "banner") {
        const hooks = BANNER_PRESETS.filter((b) =>
          selectedBannerPresetIds.has(b.id)
        ).map((b) => ({
          line1Text: b.line1Text,
          line2Text: b.line2Text,
        }));
        if (hooks.length === 0) {
          return { ok: false, error: "Turn on at least one banner preset." };
        }
        return { ok: true, overlayStyle: "banner", hooks };
      }
      const hooks = FULLTEXT_PRESETS.filter((f) =>
        selectedFulltextPresetIds.has(f.id)
      ).map((f) => ({ text: f.text }));
      if (hooks.length === 0) {
        return { ok: false, error: "Turn on at least one fulltext preset." };
      }
      return { ok: true, overlayStyle: "fulltext", hooks };
    }

    if (customStyle === "banner") {
      const hooks = parseCustomBannerLines(customHooksText);
      if (hooks.length === 0) {
        return {
          ok: false,
          error:
            "Add at least one banner line as: Line 1 | Line 2 (use | between lines).",
        };
      }
      return { ok: true, overlayStyle: "banner", hooks };
    }

    const hooks = parseCustomFulltextLines(customHooksText);
    if (hooks.length === 0) {
      return {
        ok: false,
        error: "Add at least one line of fulltext (one hook per line).",
      };
    }
    return { ok: true, overlayStyle: "fulltext", hooks };
  }

  async function onProcess() {
    setError(null);
    setStep(null);
    setDownloads(null);
    setZipBatchId(null);
    setProcessProgress(null);
    if (files.length === 0) {
      setError("Add at least one video.");
      return;
    }

    const built = buildHooksPayload();
    if (!built.ok) {
      setError(built.error);
      return;
    }

    setBusy(true);
    try {
      setStep("Creating batch…");
      const createRes = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overlayStyle: built.overlayStyle,
          hooks: built.hooks,
          files: files.map((f) => ({
            name: f.name,
            contentType: f.type || undefined,
          })),
        }),
      });
      const createRaw = await createRes.text();
      let createData: {
        error?: string;
        batchId?: string;
        uploads?: { videoId: string; contentType: string }[];
      };
      try {
        createData = createRaw ? (JSON.parse(createRaw) as typeof createData) : {};
      } catch {
        throw new Error(
          devOrProd(
            `Bad response from /api/batches (HTTP ${createRes.status}). Check the Next.js terminal — the route may have crashed.`,
            `Bad response from /api/batches (HTTP ${createRes.status}). Please try again.`
          )
        );
      }
      if (!createRes.ok) {
        throw new Error(createData.error ?? "Could not create batch");
      }
      const { batchId, uploads } = createData;
      if (!batchId || !uploads?.length) {
        throw new Error("Invalid response from server");
      }

      const uploaded: { videoId: string; rawRelPath: string }[] = [];
      for (let i = 0; i < uploads.length; i++) {
        const u = uploads[i]!;
        const file = files[i]!;
        setStep(`Uploading ${i + 1} / ${uploads.length}…`);

        const fd = new FormData();
        fd.append("batchId", batchId);
        fd.append("videoId", u.videoId);
        fd.append("file", file);
        const put = await fetch("/api/batches/upload", {
          method: "POST",
          body: fd,
        });
        const putRaw = await put.text();
        let putJson: { error?: string; rawRelPath?: string };
        try {
          putJson = putRaw ? (JSON.parse(putRaw) as typeof putJson) : {};
        } catch {
          throw new Error(
            devOrProd(
              `Upload failed for ${file.name} (HTTP ${put.status}). Response was not JSON — see Next.js terminal.`,
              `Upload failed for ${file.name} (HTTP ${put.status}). Please try again.`
            )
          );
        }
        if (!put.ok) {
          throw new Error(
            putJson.error ??
              `Upload failed for ${file.name} (${put.status}).`
          );
        }
        if (!putJson.rawRelPath) {
          throw new Error("Invalid upload response");
        }
        uploaded.push({ videoId: u.videoId, rawRelPath: putJson.rawRelPath });
      }

      setStep(null);
      const procRes = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId,
          overlayStyle: built.overlayStyle,
          hooks: built.hooks,
          videos: uploaded.map((x) => ({
            videoId: x.videoId,
            rawRelPath: x.rawRelPath,
          })),
        }),
      });
      const procRaw = await procRes.text();
      let procStart: {
        error?: string;
        accepted?: boolean;
        total?: number;
      };
      try {
        procStart = procRaw ? (JSON.parse(procRaw) as typeof procStart) : {};
      } catch {
        throw new Error(
          devOrProd(
            `Bad response from /api/process (HTTP ${procRes.status}). Check Next.js and the Python worker terminal.`,
            `Bad response from /api/process (HTTP ${procRes.status}). Processing may be temporarily unavailable — please try again.`
          )
        );
      }
      if (procRes.status === 409) {
        throw new Error(
          procStart.error ??
            "This batch is already processing. Wait and refresh, or start a new upload."
        );
      }
      if (!procRes.ok || !procStart.accepted) {
        throw new Error(
          procStart.error ??
            devOrProd(
              "Processing failed. Is WORKER_URL set and the worker running on port 8000?",
              "Processing failed. Please try again in a few minutes."
            )
        );
      }

      const totalVideos = procStart.total ?? uploads.length;
      setProcessProgress({
        total: totalVideos,
        finished: 0,
        etaSeconds: null,
      });

      type StatusPayload = {
        found?: boolean;
        total?: number;
        finished?: number;
        done?: boolean;
        complete?: boolean;
        fatalError?: string;
        downloads?: { videoId: string; url: string }[];
        errors?: string[];
        etaSeconds?: number | null;
      };

      let lastStatus: StatusPayload | null = null;
      for (;;) {
        const statusRes = await fetch(
          `/api/batches/${encodeURIComponent(batchId)}/process-status`
        );
        const statusRaw = await statusRes.text();
        let statusData: StatusPayload;
        try {
          statusData = statusRaw
            ? (JSON.parse(statusRaw) as StatusPayload)
            : {};
        } catch {
          throw new Error(
            `Invalid JSON from process status (HTTP ${statusRes.status}).`
          );
        }
        if (statusRes.status === 404 || statusData.found === false) {
          throw new Error(
            devOrProd(
              "Lost batch status (dev server may have restarted). Run Process videos again.",
              "Batch status was lost. Please run Process videos again."
            )
          );
        }
        lastStatus = statusData;
        setProcessProgress({
          total: statusData.total ?? totalVideos,
          finished: statusData.finished ?? 0,
          etaSeconds:
            statusData.etaSeconds === undefined
              ? null
              : statusData.etaSeconds,
        });
        if (statusData.done) break;
        await sleep(PROCESS_POLL_MS);
      }

      setProcessProgress(null);

      const procData = lastStatus!;
      if (procData.fatalError) {
        throw new Error(procData.fatalError);
      }
      if (procData.errors?.length) {
        setError(
          `Some videos failed: ${procData.errors.slice(0, 5).join("; ")}`
        );
      }

      const nameByVideoId = new Map(
        uploads.map((u, idx) => [u.videoId, files[idx]?.name ?? u.videoId])
      );
      const dl =
        procData.downloads?.map((d) => ({
          videoId: d.videoId,
          fileName: nameByVideoId.get(d.videoId) ?? d.videoId,
          url: d.url,
        })) ?? [];
      setDownloads(dl.length ? dl : null);
      setZipBatchId(
        procData.complete && dl.length > 0 ? batchId : null
      );
      router.refresh();
    } catch (e) {
      setStep(null);
      setError(explainFetchError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-10 text-sm text-zinc-300"
      onSubmit={(e) => {
        e.preventDefault();
        void onProcess();
      }}
      noValidate
    >
      {error ? (
        <p className="rounded border border-red-900/80 bg-red-950/40 px-3 py-2 text-red-200">
          {error}
        </p>
      ) : null}
      {step ? (
        <p className="text-zinc-500" aria-live="polite">
          {step}
        </p>
      ) : null}

      {processProgress ? (
        <div className="space-y-2 rounded-lg border border-zinc-700 bg-zinc-950/80 px-4 py-3">
          <p className="text-sm text-zinc-200" aria-live="polite">
            {processProgress.finished} of {processProgress.total} videos processed
          </p>
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800"
            role="progressbar"
            aria-valuenow={processProgress.finished}
            aria-valuemin={0}
            aria-valuemax={processProgress.total}
            aria-label="Batch processing progress"
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-500 ease-out"
              style={{
                width:
                  processProgress.total > 0
                    ? `${(100 * processProgress.finished) / processProgress.total}%`
                    : "0%",
              }}
            />
          </div>
          <p className="text-xs text-zinc-500">
            {processProgress.finished >= processProgress.total ? (
              "Finishing…"
            ) : processProgress.finished === 0 ? (
              "Estimating time remaining…"
            ) : processProgress.etaSeconds != null &&
              processProgress.etaSeconds > 0 ? (
              formatEta(processProgress.etaSeconds)
            ) : (
              "Calculating estimate…"
            )}
          </p>
        </div>
      ) : null}

      <section className="space-y-4">
        <h2 className="sr-only">Hook source</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setHookSource("presets")}
            className={`rounded-xl border-2 px-5 py-4 text-left transition ${
              hookSource === "presets"
                ? "border-white bg-zinc-900 text-white"
                : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            <span className="block text-base font-semibold">Use Presets</span>
            <span className="mt-1 block text-xs font-normal text-zinc-500">
              Pick ready-made looks — no typing
            </span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setHookSource("custom")}
            className={`rounded-xl border-2 px-5 py-4 text-left transition ${
              hookSource === "custom"
                ? "border-white bg-zinc-900 text-white"
                : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            <span className="block text-base font-semibold">Custom Hooks</span>
            <span className="mt-1 block text-xs font-normal text-zinc-500">
              Paste many variations at once
            </span>
          </button>
        </div>

        {hookSource === "presets" ? (
          <div className="space-y-4 pt-2">
            <p className="text-xs text-zinc-500">
              Choose banner or fulltext presets. Only selected cards are used;
              one random pick per video.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setPresetStyle("banner")}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  presetStyle === "banner"
                    ? "bg-white text-zinc-900"
                    : "border border-zinc-600 text-zinc-300 hover:border-zinc-400"
                }`}
              >
                Banner presets
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setPresetStyle("fulltext")}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  presetStyle === "fulltext"
                    ? "bg-white text-zinc-900"
                    : "border border-zinc-600 text-zinc-300 hover:border-zinc-400"
                }`}
              >
                Fulltext presets
              </button>
            </div>

            {presetStyle === "banner" ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {BANNER_PRESETS.map((p) => {
                  const on = selectedBannerPresetIds.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={busy}
                      onClick={() => toggleBannerPreset(p.id)}
                      aria-pressed={on}
                      className={`rounded-xl border p-2 text-left transition ${
                        on
                          ? "border-white ring-2 ring-white/30"
                          : "border-zinc-700 opacity-60 hover:border-zinc-500 hover:opacity-90"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] ${
                            on
                              ? "border-white bg-white text-zinc-900"
                              : "border-zinc-500 text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                        <span className="truncate text-[10px] text-zinc-500">
                          {on ? "In rotation" : "Off"}
                        </span>
                      </div>
                      <PresetBannerMini p={p} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {FULLTEXT_PRESETS.map((p) => {
                  const on = selectedFulltextPresetIds.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={busy}
                      onClick={() => toggleFulltextPreset(p.id)}
                      aria-pressed={on}
                      className={`rounded-xl border p-2 text-left transition ${
                        on
                          ? "border-white ring-2 ring-white/30"
                          : "border-zinc-700 opacity-60 hover:border-zinc-500 hover:opacity-90"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] ${
                            on
                              ? "border-white bg-white text-zinc-900"
                              : "border-zinc-500 text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                        <span className="truncate text-[10px] text-zinc-500">
                          {on ? "In rotation" : "Off"}
                        </span>
                      </div>
                      <PresetFulltextMini p={p} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setCustomStyle("banner")}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  customStyle === "banner"
                    ? "bg-white text-zinc-900"
                    : "border border-zinc-600 text-zinc-300 hover:border-zinc-400"
                }`}
              >
                Banner
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setCustomStyle("fulltext")}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  customStyle === "fulltext"
                    ? "bg-white text-zinc-900"
                    : "border border-zinc-600 text-zinc-300 hover:border-zinc-400"
                }`}
              >
                Fulltext
              </button>
            </div>
            <div>
              <label
                htmlFor="custom-hooks"
                className="mb-2 block text-xs font-medium text-zinc-400"
              >
                {customStyle === "banner"
                  ? "One variation per line: Line 1 | Line 2"
                  : "One hook per line"}
              </label>
              <textarea
                id="custom-hooks"
                disabled={busy}
                rows={10}
                value={customHooksText}
                onChange={(e) => setCustomHooksText(e.target.value)}
                placeholder={
                  customStyle === "banner"
                    ? BANNER_CUSTOM_PLACEHOLDER
                    : FULLTEXT_CUSTOM_PLACEHOLDER
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 font-mono text-sm text-zinc-100 placeholder:text-zinc-600"
              />
              <p className="mt-1.5 text-xs text-zinc-500">
                Emojis not supported yet
              </p>
              <p className="mt-2 text-xs text-zinc-600">
                {customStyle === "banner"
                  ? "Use the pipe character | between the two banner lines. Empty lines are skipped."
                  : "Paste as many lines as you want — each non-empty line is its own variation."}
              </p>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-medium text-zinc-200">Videos</h2>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files?.length) {
              const added = addFiles(e.dataTransfer.files);
              if (added === 0) {
                setError(
                  "Dropped files are not supported. Use .mp4, .mov, or .m4v."
                );
              }
            }
          }}
          className={`rounded border border-dashed px-4 py-10 text-center ${
            drag ? "border-zinc-500 bg-zinc-900/50" : "border-zinc-700"
          }`}
        >
          <input
            type="file"
            accept={ACCEPT}
            multiple
            disabled={busy}
            className="hidden"
            id="file-input"
            onChange={(e) => {
              const input = e.target;
              const list = input.files;
              if (list?.length) {
                const added = addFiles(list);
                if (added === 0) {
                  setError(
                    "No supported videos in that selection. Use .mp4, .mov, or .m4v."
                  );
                }
              }
              input.value = "";
            }}
          />
          <label htmlFor="file-input" className="cursor-pointer text-zinc-400">
            Drag and drop .mp4 / .mov here, or{" "}
            <span className="text-zinc-200 underline">choose files</span>
          </label>
        </div>
        {files.length > 0 ? (
          <ul className="mt-4 space-y-1 text-xs text-zinc-500">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center justify-between gap-2"
              >
                <span className="truncate text-zinc-400">{f.name}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeFile(i)}
                  className="shrink-0 text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {IS_DEV ? (
          <p className="mt-3 text-xs text-zinc-600">
            <span className="text-zinc-500">Local dev:</span> uploads go to{" "}
            <code className="text-zinc-500">web/.data/media/raw/</code>, outputs
            to <code className="text-zinc-500">out/</code>. Set{" "}
            <code className="text-zinc-500">WORKER_URL</code> to your FastAPI
            worker; worker and Next must share the same folder (see{" "}
            <code className="text-zinc-500">BOFBOT_MEDIA_ROOT</code> /{" "}
            <code className="text-zinc-500">LOCAL_MEDIA_ROOT</code> in{" "}
            <code className="text-zinc-500">.env.example</code>).
          </p>
        ) : null}
      </section>

      <button
        type="submit"
        disabled={busy || files.length === 0}
        className="rounded-lg bg-white py-3 text-sm font-medium text-zinc-900 disabled:opacity-40"
      >
        {busy ? "Working…" : "Process videos"}
      </button>

      {downloads?.length ? (
        <section className="rounded-lg border border-emerald-900/60 bg-emerald-950/25 px-4 py-4">
          <h2 className="text-sm font-medium text-emerald-100/95">
            Processed videos
          </h2>
          <p className="mt-1 text-xs text-emerald-200/70">
            {IS_DEV
              ? "Files are served from this dev server. Open each link to download (local disk only — no cloud, history not saved unless you wire the DB back in)."
              : "Open each link to download your files."}
          </p>
          {zipBatchId ? (
            <p className="mt-3">
              <a
                href={`/api/download-local/${encodeURIComponent(zipBatchId)}/zip`}
                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                download
              >
                Download all (.zip)
              </a>
            </p>
          ) : null}
          <ul className="mt-3 space-y-2 text-sm">
            {downloads.map((d) => (
              <li key={d.videoId}>
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-200 underline hover:text-white"
                >
                  {d.fileName}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </form>
  );
}
