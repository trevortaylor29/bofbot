import { NextResponse } from "next/server";

import {
  AFFILIATE_COOKIE_MAX_AGE_SEC,
  BOFBOT_AFFILIATE_COOKIE,
  sanitizeAffiliateRef,
} from "@/lib/affiliate-ref";

/**
 * Sets the affiliate ref cookie (same as middleware) for client navigations
 * where `?ref=` may not hit middleware with the desired timing.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const raw =
    body &&
    typeof body === "object" &&
    "ref" in body &&
    typeof (body as { ref: unknown }).ref === "string"
      ? (body as { ref: string }).ref
      : null;
  const ref = sanitizeAffiliateRef(raw);
  if (!ref) {
    return NextResponse.json({ error: "Invalid ref" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(BOFBOT_AFFILIATE_COOKIE, ref, {
    maxAge: AFFILIATE_COOKIE_MAX_AGE_SEC,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });
  return res;
}
