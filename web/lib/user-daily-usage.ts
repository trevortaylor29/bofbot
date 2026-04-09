/** UTC calendar “day” for daily video limits (not local timezone). */

export function utcUsageDate(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

export function isSameUtcUsageDay(
  stored: Date | null | undefined,
  reference: Date
): boolean {
  if (!stored) return false;
  return (
    stored.getUTCFullYear() === reference.getUTCFullYear() &&
    stored.getUTCMonth() === reference.getUTCMonth() &&
    stored.getUTCDate() === reference.getUTCDate()
  );
}

export function effectiveVideosProcessedToday(
  usageDay: Date | null | undefined,
  storedCount: number
): number {
  const today = utcUsageDate();
  if (!isSameUtcUsageDay(usageDay, today)) return 0;
  return storedCount;
}
