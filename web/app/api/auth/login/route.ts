import { NextResponse } from "next/server";

import { signIn } from "@/auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { rateLimitResponse } from "@/lib/too-many-requests";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 10;

/**
 * JSON login for API clients. Browser flows can use signIn() from next-auth/react instead.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = rateLimit(`login:${ip}`, MAX_PER_HOUR, WINDOW_MS);
  if (!rl.ok) return rateLimitResponse(rl);

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.toLowerCase().trim();
  const password = body.password;
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true });
}
