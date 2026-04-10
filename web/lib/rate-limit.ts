/**
 * Simple fixed-window in-memory rate limiter (per Node / serverless instance).
 * For multi-instance production, prefer Redis / Vercel KV.
 */

type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();
const PRUNE_EVERY = 500;
let ops = 0;

function prune(now: number) {
  ops += 1;
  if (ops % PRUNE_EVERY !== 0) return;
  for (const [k, b] of store) {
    if (now >= b.resetAt) store.delete(k);
  }
  if (store.size > 100_000) {
    store.clear();
  }
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

/**
 * @param key Stable key, e.g. `signup:1.2.3.4` or `checkout:userId`
 * @param limit Max requests per window
 * @param windowMs Window length in ms
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  prune(now);

  let b = store.get(key);
  if (!b || now >= b.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  b.count += 1;
  return { ok: true };
}

export function getClientIp(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}

/** UTC calendar day key for daily user caps. */
export function utcUsageDayKey(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
