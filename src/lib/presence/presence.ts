import type { PresenceState } from "@/hooks/presence/useClassPresence";

/** Matches `@convex-dev/presence` default list limit. */
export const PRESENCE_LIST_LIMIT = 104;

export type PresenceDisplaySummary = {
  userId: string;
  name?: string;
  image?: string;
};

/**
 * Stable, deduplicated online user IDs for TanStack/Convex query keys.
 * Sorted so tabs viewing the same class share one subscription.
 */
export function normalizeOnlineUserIds(
  onlineUserIds: ReadonlySet<string> | readonly string[] | undefined,
): string[] {
  if (!onlineUserIds) {
    return [];
  }
  const ids = onlineUserIds instanceof Set ? [...onlineUserIds] : [...onlineUserIds];
  if (ids.length === 0) {
    return [];
  }
  return [...new Set(ids)].sort().slice(0, PRESENCE_LIST_LIMIT);
}

/** Attach cached display fields to lightweight presence entries. */
export function mergePresenceDisplaySummaries(
  presenceState: PresenceState[] | undefined,
  summaries: PresenceDisplaySummary[] | undefined,
): PresenceState[] | undefined {
  if (presenceState === undefined) {
    return undefined;
  }
  if (!summaries?.length) {
    return presenceState;
  }

  const byUserId = new Map(summaries.map((summary) => [summary.userId, summary]));
  return presenceState.map((entry) => {
    const summary = byUserId.get(entry.userId);
    if (!summary) {
      return entry;
    }
    return {
      ...entry,
      name: summary.name,
      image: summary.image,
    };
  });
}
