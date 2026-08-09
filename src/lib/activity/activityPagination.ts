export const ACTIVITY_RECENT_PAGE_SIZE = 50;

/**
 * Overlay a live recent page onto cached infinite pages (newest-first).
 * Deduplicates by `_id`. Flags a gap when a full recent page no longer
 * intersects the cached head (more than one page of new events arrived).
 */
export function mergeActivityRecentWithPages<T extends { _id: string }>(
  recent: T[],
  cachedPages: T[][],
): { items: T[]; hasOverlapGap: boolean } {
  const cached = cachedPages.flat();

  if (recent.length === 0) {
    return { items: cached, hasOverlapGap: false };
  }
  if (cached.length === 0) {
    return { items: recent, hasOverlapGap: false };
  }

  const cachedIds = new Set(cached.map((event) => event._id));
  const recentIds = new Set(recent.map((event) => event._id));
  const hasOverlap = recent.some((event) => cachedIds.has(event._id));
  const hasOverlapGap =
    recent.length >= ACTIVITY_RECENT_PAGE_SIZE && !hasOverlap && cached.length > 0;

  return {
    items: [...recent, ...cached.filter((event) => !recentIds.has(event._id))],
    hasOverlapGap,
  };
}
