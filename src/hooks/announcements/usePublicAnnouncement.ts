import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import { api } from "../../../convex/_generated/api";
import { GC_TIME } from "@/lib/queryCache";

export function publicAnnouncementQueryKey(publicSlug: string) {
  return convexQuery(api.announcements.getByPublicSlug, { publicSlug }).queryKey;
}

/** Soft-auth public page. gcTime: 5 minutes. */
export function usePublicAnnouncement(publicSlug: string) {
  const trimmed = publicSlug.trim();
  return useQuery({
    ...convexQuery(api.announcements.getByPublicSlug, trimmed ? { publicSlug: trimmed } : "skip"),
    gcTime: GC_TIME.realtime,
    retry: false,
  });
}
