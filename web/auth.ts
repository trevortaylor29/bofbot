import "server-only";

import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { authConfig } from "@/auth.config";
import * as schema from "@/drizzle/schema";
import { db } from "@/lib/db";
import { getClientIpFromHeaders, rateLimit } from "@/lib/rate-limit";

/** Aligns with `/api/auth/login` — covers browser `signIn()` + desktop callback (same bucket per IP). */
const CREDENTIALS_WINDOW_MS = 60 * 60 * 1000;
const CREDENTIALS_MAX_PER_HOUR = 10;

const providers: NextAuthConfig["providers"] = [
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          allowDangerousEmailAccountLinking: true,
        }),
      ]
    : []),
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }
      const h = await headers();
      const ip = getClientIpFromHeaders(h);
      const rl = rateLimit(
        `auth:credentials:${ip}`,
        CREDENTIALS_MAX_PER_HOUR,
        CREDENTIALS_WINDOW_MS
      );
      if (!rl.ok) {
        return null;
      }
      const email = String(credentials.email).toLowerCase().trim();
      const user = await db.query.users.findFirst({
        where: eq(schema.users.email, email),
      });
      if (!user?.passwordHash) {
        return null;
      }
      const ok = await compare(
        String(credentials.password),
        user.passwordHash
      );
      if (!ok) {
        return null;
      }
      return {
        id: user.id,
        email: user.email,
        name: user.name ?? undefined,
        image: user.image ?? undefined,
      };
    },
  }),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  providers,
  /**
   * Auth.js defaults to database sessions when an adapter is present.
   * Credentials + Drizzle must stay on JWT so the session cookie is stable on every route.
   */
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
});
