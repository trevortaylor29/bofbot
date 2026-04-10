import { NextResponse } from "next/server";

import type { RateLimitResult } from "@/lib/rate-limit";

export function rateLimitResponse(rl: Extract<RateLimitResult, { ok: false }>) {
  return NextResponse.json(
    { error: "Too many requests. Try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfterSec) },
    }
  );
}
