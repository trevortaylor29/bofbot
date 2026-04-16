import { NextResponse } from "next/server";

import { signIn } from "@/auth";

/**
 * JSON login for API clients. Browser flows can use signIn() from next-auth/react instead.
 * Brute-force limits apply in `auth.ts` credentials `authorize` (same as web/desktop sign-in).
 */
export async function POST(request: Request) {
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
