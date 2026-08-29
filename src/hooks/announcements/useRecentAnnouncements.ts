import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { FIVE_MINUTES } from "@/lib/queryCache";

export const DASHBOARD_ANNOUNCEMENT_LIMIT = 5;

export function recentAnnouncementsQueryKey(classId: Id<"classes">) {
  return convexQuery(api.announcements.listRecent, {
    classId,
    limit: DASHBOARD_ANNOUNCEMENT_LIMIT,
  }).queryKey;
}

/** gcTime: 5 minutes — dashboard summaries; Convex keeps live data fresh while mounted. */
export function useRecentAnnouncements(classId: Id<"classes">) {
  return useAuthedQuery(
    api.announcements.listRecent,
    { classId, limit: DASHBOARD_ANNOUNCEMENT_LIMIT },
    { gcTime: FIVE_MINUTES },
  );
}
