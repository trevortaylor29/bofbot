import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe fragment (no DB / bcrypt). Used by `proxy.ts` to verify JWT sessions.
 * Full providers + adapter live in `auth.ts`.
 */
const authSecret =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "development-only-secret-min-32-characters-long";

/**
 * Local dev must use non-secure cookies (http://). Production uses Secure cookies.
 * Override: AUTH_COOKIE_SECURE=true | false
 */
const useSecureCookies =
  process.env.AUTH_COOKIE_SECURE === "true"
    ? true
    : process.env.AUTH_COOKIE_SECURE === "false"
      ? false
      : process.env.NODE_ENV === "production";

const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60;

const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: useSecureCookies,
  /** Persist across browser restarts; must align with `session.maxAge`. */
  maxAge: SESSION_MAX_AGE_SEC,
};

export const authConfig = {
  trustHost: true,
  secret: authSecret,
  useSecureCookies,
  providers: [],
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SEC },
  pages: {
    signIn: "/login",
  },
  /**
   * Explicit cookie policy so localhost keeps sessions (no Secure flag, no Domain pin).
   * Do not set `domain` — avoids cookies being scoped to a production host while testing locally.
   */
  cookies: {
    sessionToken: {
      options: sessionCookieOptions,
    },
    callbackUrl: {
      options: {
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    csrfToken: {
      options: {
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    pkceCodeVerifier: {
      options: {
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    state: {
      options: {
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const id = String(user.id);
        token.sub = id;
        token.id = id;
        if (user.name) token.name = user.name;
        if (user.email) token.email = user.email;
        const img = user.image ?? undefined;
        if (img) token.picture = img;
      } else if (token.sub && !token.id) {
        token.id = token.sub;
      }
      return token;
    },
    session({ session, token }) {
      const id = (token.id ?? token.sub) as string | undefined;
      if (session.user && id) {
        session.user.id = id;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
