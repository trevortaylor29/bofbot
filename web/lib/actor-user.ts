import { auth } from "@/auth";

/** Default DB user for no-login mode (see migration 0002_guest_user). */
export const GUEST_USER_ID = "anonymous";

/**
 * User id for API + pages when auth is optional.
 * Prefer signed-in user; else ANONYMOUS_USER_ID env; else built-in guest row.
 */
export async function getActorUserId(): Promise<string> {
  const session = await auth();
  if (session?.user?.id) {
    return session.user.id;
  }
  const fromEnv = process.env.ANONYMOUS_USER_ID?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return GUEST_USER_ID;
}
