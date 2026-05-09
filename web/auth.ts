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
      // Structured per-attempt log so we can grep Vercel logs by tag/email/step
      // when a user reports CredentialsSignin we can't otherwise reproduce.
      // Never logs the password or its hash; length only.
      const h = await headers();
      const ip = getClientIpFromHeaders(h);
      const ua = h.get("user-agent")?.slice(0, 120) || "";
      const rawEmail =
        typeof credentials?.email === "string" ? credentials.email : "";
      const email = rawEmail.toLowerCase().trim();
      const rawPwd =
        typeof credentials?.password === "string" ? credentials.password : "";
      const passwordLen = rawPwd.length;
      const log = (
        step: string,
        extra: Record<string, unknown> = {},
      ): void => {
        try {
          console.log(
            JSON.stringify({
              tag: "auth_credentials",
              step,
              email,
              ip,
              ua,
              passwordLen,
              ...extra,
            }),
          );
        } catch {
          /* never throw from logger */
        }
      };

      if (!credentials?.email || !credentials?.password) {
        log("missing_credentials", {
          hasEmail: !!credentials?.email,
          hasPassword: !!credentials?.password,
        });
        return null;
      }
      const rlKey =
        ip && ip !== "unknown"
          ? `auth:credentials:ip:${ip}:email:${email}`
          : `auth:credentials:email:${email}`;
      const rl = rateLimit(
        rlKey,
        CREDENTIALS_MAX_PER_HOUR,
        CREDENTIALS_WINDOW_MS,
      );
      if (!rl.ok) {
        log("rate_limited", { rlKey });
        return null;
      }
      const user = await db.query.users.findFirst({
        where: eq(schema.users.email, email),
      });
      if (!user) {
        log("user_not_found");
        return null;
      }
      if (!user.passwordHash) {
        log("no_password_hash", { hasGoogleAccount: true });
        return null;
      }
      const ok = await compare(rawPwd, user.passwordHash);
      if (!ok) {
        log("bad_password");
        return null;
      }
      log("ok", { userId: user.id });
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
