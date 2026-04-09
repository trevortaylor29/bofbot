"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import type { batches, videos } from "@/drizzle/schema";

type BatchRow = typeof batches.$inferSelect & {
  videos: (typeof videos.$inferSelect)[];
};

export function BatchDetail({ batchId }: { batchId: string }) {
  const searchParams = useSearchParams();
  const queuedHint = searchParams.get("queued") === "1";

  const [data, setData] = useState<BatchRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/batches/${batchId}`);
    const j = (await r.json()) as { error?: string; batch?: BatchRow };
    if (!r.ok) {
      setError(j.error ?? "Failed to load batch");
      setData(null);
      return;
    }
    setError(null);
    setData(j.batch ?? null);
  }, [batchId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data) return;
    const busy =
      data.status === "processing" || data.status === "uploading";
    if (!busy) return;
    const t = setInterval(() => void load(), 2000);
    return () => clearInterval(t);
  }, [data, load]);

  if (error) {
    return (
      <p className="text-red-300">
        {error}{" "}
        <Link href="/dashboard" className="text-zinc-400 underline">
          Dashboard
        </Link>
      </p>
    );
  }

  if (!data) {
    return <p className="text-zinc-500">Loading…</p>;
  }

  const busy =
    data.status === "processing" || data.status === "uploading";

  return (
    <div className="text-sm text-zinc-400">
      <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-300">
        ← Dashboard
      </Link>
      <h1 className="mt-6 text-xl font-medium text-zinc-100">Batch</h1>
      <p className="mt-2 font-mono text-xs text-zinc-500">{data.id}</p>
      {queuedHint ? (
        <p className="mt-4 rounded border border-amber-900/80 bg-amber-950/40 px-3 py-2 text-sm text-amber-100/95">
          This batch is queued for background processing. Keep{" "}
          <code className="rounded bg-zinc-900 px-1 py-0.5 text-xs text-zinc-300">
            npm run worker:video
          </code>{" "}
          running so videos finish.
        </p>
      ) : null}
      {busy ? (
        <p className="mt-3 text-amber-200/90" aria-live="polite">
          Processing… refreshing every 2s.
        </p>
      ) : null}
      <dl className="mt-6 grid gap-2 text-zinc-300">
        <div>
          <dt className="text-zinc-500">Status</dt>
          <dd>{data.status}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Style</dt>
          <dd>{data.overlayStyle}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Progress</dt>
          <dd>
            {data.processedVideos} / {data.totalVideos}
          </dd>
        </div>
      </dl>
      <h2 className="mt-8 font-medium text-zinc-200">Videos</h2>
      <ul className="mt-3 space-y-2">
        {data.videos.map((v) => (
          <li
            key={v.id}
            className="rounded border border-zinc-800 px-3 py-2 text-xs"
          >
            <div className="text-zinc-500">{v.status}</div>
            <div className="truncate font-mono text-zinc-400" title="Raw path">
              {v.rawMediaPath}
            </div>
            {v.processedMediaPath ? (
              <div
                className="mt-1 truncate font-mono text-zinc-500"
                title="Output path"
              >
                → {v.processedMediaPath}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
