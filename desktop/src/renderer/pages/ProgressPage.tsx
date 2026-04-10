import { useEffect, useRef, useState } from "react";

import { PlanBlockModal } from "../components/PlanBlockModal";
import type { BatchPayload, ProgressEvent } from "../types";

function planFailureModalVariant(
  code: string | undefined
):
  | "internet"
  | "session_expired"
  | "daily_limit"
  | "starter_hooks"
  | "free_custom_hooks"
  | "custom_hooks_limit"
  | null {
  if (!code) return null;
  if (code === "daily_limit") return "daily_limit";
  if (code === "starter_custom") return "starter_hooks";
  if (code === "free_custom_hooks") return "free_custom_hooks";
  if (code === "custom_hooks_limit") return "custom_hooks_limit";
  if (code === "plan_unreachable") return "internet";
  if (code === "not_signed_in") return "session_expired";
  return null;
}

type Props = {
  payload: BatchPayload;
  onDone: () => void;
  onBack: () => void;
};

export function ProgressPage({ payload, onDone, onBack }: Props) {
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [finished, setFinished] = useState<{
    ok: boolean;
    error?: string;
    code?: string;
    outputDir?: string;
    processed?: number;
  } | null>(null);
  const [planModalDismissed, setPlanModalDismissed] = useState(false);
  const startedAt = useRef(Date.now());
  const [etaSec, setEtaSec] = useState<number | null>(null);

  useEffect(() => {
    setPlanModalDismissed(false);
    startedAt.current = Date.now();
    const off = window.bofbot.onProgress((ev) => {
      setProgress(ev);
      const elapsed = (Date.now() - startedAt.current) / 1000;
      if (ev.phase === "processing" && ev.current >= 1 && ev.total > 0) {
        const per = elapsed / ev.current;
        const remaining = Math.max(0, ev.total - ev.current);
        setEtaSec(Math.round(per * remaining));
      }
    });

    let cancelled = false;
    (async () => {
      const r = await window.bofbot.processBatch(payload);
      if (cancelled) return;
      setFinished({
        ok: r.ok,
        error: r.error,
        code: r.code,
        outputDir: r.outputDir,
        processed: r.processed,
      });
      off();
    })();

    return () => {
      cancelled = true;
      off();
    };
  }, [payload]);

  const total = progress?.total ?? payload.filePaths.length;
  const current = progress?.current ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const phaseLabel =
    progress?.phase === "copy"
      ? "Copying…"
      : progress?.phase === "processing"
        ? "Processing…"
        : progress?.phase === "done"
          ? "Done"
          : "Starting…";

  async function openOutput() {
    const dir = finished?.outputDir;
    if (!dir) return;
    await window.bofbot.openPath(dir);
  }

  const failureModal =
    finished && !finished.ok && !planModalDismissed
      ? planFailureModalVariant(finished.code)
      : null;

  if (finished) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem 1.5rem",
        }}
      >
        {failureModal && (
          <PlanBlockModal
            variant={failureModal}
            onClose={() => setPlanModalDismissed(true)}
          />
        )}
        <div className="card" style={{ width: "100%", maxWidth: 440, textAlign: "center" }}>
          <h2 className="font-display" style={{ fontSize: "1.35rem", margin: "0 0 0.75rem" }}>
            {finished.ok ? "Batch complete" : "Batch stopped"}
          </h2>
          {!finished.ok && finished.error && (
            <p style={{ color: "var(--coral)", textAlign: "center", margin: "0 0 1rem", fontSize: "0.9rem" }}>{finished.error}</p>
          )}
          {finished.ok && typeof finished.processed === "number" && (
            <p style={{ color: "var(--muted)", margin: "0 0 1.25rem" }}>Processed {finished.processed} video(s).</p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center" }}>
            {finished.ok && finished.outputDir && (
              <button type="button" className="btn-primary btn-primary--large" onClick={openOutput}>
                Open output folder
              </button>
            )}
            <button type="button" className="btn-ghost" onClick={onDone}>
              Back to home
            </button>
            {!finished.ok && (
              <button type="button" className="btn-ghost" onClick={onBack}>
                Edit batch
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.5rem",
        width: "100%",
      }}
    >
      <div className="card" style={{ width: "100%", maxWidth: 440 }}>
        <h2 className="font-display" style={{ fontSize: "1.2rem", margin: "0 0 1rem", textAlign: "center" }}>
          Processing
        </h2>
        <div className="progress-bar progress-bar--neutral" style={{ width: "100%", marginBottom: "1rem" }}>
          <div style={{ width: `${pct}%` }} />
        </div>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: 0, textAlign: "center" }}>
          {current}/{total} — {phaseLabel}
          {progress?.fileName ? (
            <>
              <br />
              <span style={{ fontSize: "0.8rem" }}>{progress.fileName}</span>
            </>
          ) : null}
        </p>
        {etaSec != null && etaSec > 0 && progress?.phase === "processing" && (
          <p style={{ color: "var(--muted-dim)", fontSize: "0.85rem", margin: "0.75rem 0 0", textAlign: "center" }}>
            About {etaSec}s remaining (estimate)
          </p>
        )}
      </div>
    </div>
  );
}
