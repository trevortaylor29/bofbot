import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { users } from "@/drizzle/schema";
import { isDbConnectionError } from "@/lib/db-errors";
import { db } from "@/lib/db";

export async function POST(request: Request) {
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

    return NextResponse.json(
      { id: created.id, email: created.email },
      { status: 201 }
    );
  } catch (e) {
    if (isDbConnectionError(e)) {
      return NextResponse.json(
        {
          error:
            "Cannot reach the database. Set DATABASE_URL in .env.local (e.g. your Neon connection string) and run migrations.",
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
