import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { Resend } from "resend";

import { users } from "@/drizzle/schema";
import { isDbConnectionError } from "@/lib/db-errors";
import { db } from "@/lib/db";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import {
  buildWelcomePlainText,
  welcomeEmailReplyTo,
} from "@/lib/welcome-email-text";
import { rateLimitResponse } from "@/lib/too-many-requests";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 5;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = rateLimit(`signup:${ip}`, MAX_PER_HOUR, WINDOW_MS);
  if (!rl.ok) return rateLimitResponse(rl);

  let body: { email?: string; password?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.toLowerCase().trim();
  const password = body.password;
  const name = body.name?.trim();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);
    const now = new Date();

    const [created] = await db
      .insert(users)
      .values({
        email,
        name: name || null,
        passwordHash,
        billingPeriodStart: now,
      })
      .returning({ id: users.id, email: users.email });

    try {
      const apiKey = process.env.RESEND_API_KEY?.trim();
      const from = process.env.RESEND_FROM_EMAIL?.trim();
      if (apiKey && from) {
        const resend = new Resend(apiKey);
        const { data, error } = await resend.emails.send({
          from,
          to: [created.email],
          replyTo: welcomeEmailReplyTo(),
          subject: "Welcome to BofBot",
          text: buildWelcomePlainText(name),
        });
        if (!error && data?.id) {
          await db
            .update(users)
            .set({ welcomeEmailSent: true, updatedAt: new Date() })
            .where(eq(users.id, created.id));
        } else {
          console.warn(
            "[signup] welcome email not sent:",
            error?.message ?? "no Resend id"
          );
        }
      }
    } catch (e) {
      console.warn("[signup] welcome email error:", e);
    }

    return NextResponse.json(
      { id: created.id, email: created.email },
      { status: 201 }
    );
  } catch (e) {
    if (isDbConnectionError(e)) {
      return NextResponse.json(
        {
          error:
            "Cannot reach the database. The service may be misconfigured or temporarily unavailable.",
          code: "DB_CONNECTION",
        },
        { status: 503 }
      );
    }
    console.error(e);
    return NextResponse.json(
      { error: "Sign up failed. Check server logs." },
      { status: 500 }
    );
  }
}
