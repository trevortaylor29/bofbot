/**
 * Affiliate `?ref=` → HttpOnly cookie → Stripe Checkout promotion code (same string as Stripe “Code”).
 * Edge-safe (used from middleware); no Node-only imports.
 */

export const BOFBOT_AFFILIATE_COOKIE = "bofbot_ref";

/** 30 days */
export const AFFILIATE_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30;

const MAX_LEN = 40;
/** Customer-facing promotion codes: letters, digits, hyphen, underscore */
const REF_SAFE = /^[a-zA-Z0-9_-]+$/;

/**
 * Sanitize `ref` query/body for storage and Stripe lookup. Preserves case.
 * @returns null if missing or invalid
 */
export function sanitizeAffiliateRef(
  raw: string | null | undefined
): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t || t.length > MAX_LEN) return null;
  if (!REF_SAFE.test(t)) return null;
  return t;
}

export function parseAffiliateRefFromCookieHeader(
  cookieHeader: string | null | undefined
): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  const prefix = `${BOFBOT_AFFILIATE_COOKIE}=`;
  for (const p of parts) {
    if (p.startsWith(prefix)) {
      let raw = p.slice(prefix.length);
      try {
        raw = decodeURIComponent(raw);
      } catch {
        return null;
      }
      return sanitizeAffiliateRef(raw);
    }
  }
  return null;
}

/** Distinct strings to try with Stripe’s exact-match `code` filter */
export function affiliateRefStripeLookupVariants(ref: string): string[] {
  const seen = new Set<string>();
  const add = (s: string) => {
    if (s && s.length <= MAX_LEN && REF_SAFE.test(s)) seen.add(s);
  };
  add(ref);
  add(ref.toUpperCase());
  add(ref.toLowerCase());
  return [...seen];
}
