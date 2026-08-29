import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { GC_TIME } from "@/lib/queryCache";

export function announcementsListQueryKey(classId: Id<"classes">) {
  return convexQuery(api.announcements.list, { classId }).queryKey;
}

/** gcTime: 5 minutes — reactive via Convex; moderate cache after unmount. */
export function useAnnouncements(classId: Id<"classes">) {
  return useAuthedQuery(api.announcements.list, { classId }, { gcTime: GC_TIME.realtime });
}
