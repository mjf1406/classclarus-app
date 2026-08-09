import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import { api } from "../../../convex/_generated/api";
import { FIVE_MINUTES } from "@/lib/queryCache";

export function publicPointsBoardQueryKey(publicSlug: string) {
  return convexQuery(api.points.getPublicBoard, { publicSlug }).queryKey;
}

/** Soft-auth public page. gcTime: 5 minutes. */
export function usePublicPointsBoard(publicSlug: string) {
  const trimmed = publicSlug.trim();
  return useQuery({
    ...convexQuery(api.points.getPublicBoard, trimmed ? { publicSlug: trimmed } : "skip"),
    gcTime: FIVE_MINUTES,
    retry: false,
  });
}
