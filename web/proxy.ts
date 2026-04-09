import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

function needsAuth(pathname: string): boolean {
  if (pathname.startsWith("/dashboard")) return true;
  if (pathname.startsWith("/hooks")) return true;
  return false;
}

export default auth((req) => {
  if (!needsAuth(req.nextUrl.pathname)) {
    return NextResponse.next();
  }
  if (req.auth) {
    return NextResponse.next();
  }
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const login = new URL("/login", req.url);
  login.searchParams.set(
    "callbackUrl",
    `${req.nextUrl.pathname}${req.nextUrl.search}`
  );
  return NextResponse.redirect(login);
});

/**
 * Only protect HTML routes. Do NOT list `/api/checkout*` here: NextAuth's wrapper
 * merges `getSession()` Set-Cookie onto responses; that broke sessions when combined
 * with client `fetch` (paid pricing now uses top-level GET `/api/checkout/start` instead).
 */
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/hooks",
    "/hooks/:path*",
  ],
};
