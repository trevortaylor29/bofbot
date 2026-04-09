/**
 * In-memory registration for ephemeral upload batches (no DB).
 * Prevents arbitrary writes: only registered videoIds can be uploaded.
 *
 * Store lives on globalThis so every Next route bundle shares one Map. Without
 * this, Turbopack/webpack can instantiate this module twice and uploads see
 * an empty store right after POST /api/batches registered the batch.
 */
type Entry = { videoIds: Set<string>; expiresAt: number };

const TTL_MS = 2 * 60 * 60 * 1000; // 2h

const g = globalThis as typeof globalThis & {
  __bofbotPendingBatches?: Map<string, Entry>;
};

const store = g.__bofbotPendingBatches ?? new Map<string, Entry>();
g.__bofbotPendingBatches = store;

export function registerBatch(batchId: string, videoIds: string[]): void {
  store.set(batchId, {
    videoIds: new Set(videoIds),
    expiresAt: Date.now() + TTL_MS,
  });
}

export function canUploadToSlot(
  batchId: string,
  videoId: string
): boolean {
  prune();
  const e = store.get(batchId);
  if (!e || e.expiresAt < Date.now()) return false;
  return e.videoIds.has(videoId);
}

export function releaseBatch(batchId: string): void {
  store.delete(batchId);
}

function prune(): void {
  const now = Date.now();
  for (const [id, e] of store) {
    if (e.expiresAt < now) store.delete(id);
  }
}
