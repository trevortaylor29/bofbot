const CONNECTION_CODES = new Set([
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
]);

export function isDbConnectionError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const err = e as Record<string, unknown>;
  // node-postgres often wraps as AggregateError with ECONNREFUSED on nested errors
  if (err.name === "AggregateError" && Array.isArray(err.errors)) {
    return err.errors.some((sub) => isDbConnectionError(sub));
  }
  const code = err.code;
  if (typeof code === "string" && CONNECTION_CODES.has(code)) return true;
  const cause = err.cause as Record<string, unknown> | undefined;
  if (typeof cause?.code === "string" && CONNECTION_CODES.has(cause.code)) {
    return true;
  }
  const msg = String(err.message ?? "");
  if (
    /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|getaddrinfo|connect ECONNREFUSED/i.test(
      msg
    )
  ) {
    return true;
  }
  return false;
}
