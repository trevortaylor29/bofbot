import { NextResponse } from "next/server";
import { Resend } from "resend";

import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { rateLimitResponse } from "@/lib/too-many-requests";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = rateLimit(`contact:${ip}`, MAX_PER_HOUR, WINDOW_MS);
  if (!rl.ok) return rateLimitResponse(rl);

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = process.env.CONTACT_EMAIL?.trim();
  if (!apiKey || !to) {
    return NextResponse.json(
      { error: "Contact form is not configured." },
      { status: 503 }
    );
  }

  let body: { email?: string; subject?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim();
  const subject = body.subject?.trim();
  const message = body.message?.trim();
  if (!email || !subject || !message) {
    return NextResponse.json(
      { error: "Email, subject, and message are required." },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Invalid email address." },
      { status: 400 }
    );
  }
  if (subject.length > 200 || message.length > 20_000) {
    return NextResponse.json({ error: "Message too long." }, { status: 400 });
  }

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "BofBot Contact <onboarding@resend.dev>";

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: [to],
      replyTo: email,
      subject: `[BofBot contact] ${subject}`,
      text: `From: ${email}\n\n${message}`,
    });

    if (error) {
      console.error("[contact] Resend:", error.message, error.name);
      return NextResponse.json(
        { error: "Could not send message. Try again later." },
        { status: 502 }
      );
    }

    if (!data?.id) {
      return NextResponse.json(
        { error: "Could not send message. Try again later." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[contact]", e);
    return NextResponse.json(
      { error: "Could not send message. Try again later." },
      { status: 502 }
    );
  }
}
