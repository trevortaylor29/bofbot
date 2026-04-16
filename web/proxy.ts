import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";
import {
  AFFILIATE_COOKIE_MAX_AGE_SEC,
  BOFBOT_AFFILIATE_COOKIE,
  sanitizeAffiliateRef,
} from "@/lib/affiliate-ref";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

function needsAuth(pathname: string): boolean {
  if (pathname.startsWith("/dashboard")) return true;
  if (pathname.startsWith("/hooks")) return true;
  return false;
}

function attachAffiliateRefCookie(req: { nextUrl: URL }, res: NextResponse) {
  const ref = sanitizeAffiliateRef(req.nextUrl.searchParams.get("ref"));
  if (ref) {
    res.cookies.set(BOFBOT_AFFILIATE_COOKIE, ref, {
      maxAge: AFFILIATE_COOKIE_MAX_AGE_SEC,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    });
  }
  return res;
}

export default auth((req) => {
  if (!needsAuth(req.nextUrl.pathname)) {
    return attachAffiliateRefCookie(req, NextResponse.next());
  }
  if (req.auth) {
    return attachAffiliateRefCookie(req, NextResponse.next());
  }
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return attachAffiliateRefCookie(
      req,
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
  }
  const login = new URL("/login", req.url);
  login.searchParams.set(
    "callbackUrl",
    `${req.nextUrl.pathname}${req.nextUrl.search}`
  );
  return attachAffiliateRefCookie(req, NextResponse.redirect(login));
});

/**
 * Pages: `?ref=` affiliate cookie + auth for dashboard/hooks only.
 * Excludes `/api/*` so Auth.js session handling does not run on checkout/API fetch
 * (see history in `PricingCheckoutButton` / GET `/api/checkout/start`).
 */
export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
