import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { FIVE_MINUTES } from "@/lib/queryCache";

export function announcementDetailQueryKey(
  classId: Id<"classes">,
  announcementId: Id<"announcements">,
) {
  return convexQuery(api.announcements.get, { classId, announcementId }).queryKey;
}

/** gcTime: 5 minutes — reactive via Convex; moderate cache after unmount. */
export function useAnnouncement(classId: Id<"classes">, announcementId: Id<"announcements">) {
  return useAuthedQuery(
    api.announcements.get,
    { classId, announcementId },
    { gcTime: FIVE_MINUTES },
  );
}
