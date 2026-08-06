import { useConvexAuth } from "@convex-dev/auth/react";
import { usePaginatedQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const CLASS_ACTIVITY_PAGE_SIZE = 50;

/**
 * Paginated class activity log (newest first).
 * Uses Convex `usePaginatedQuery` for cursor pagination; gated on auth.
 * Live updates via Convex subscription (no TanStack gcTime on this path).
 */
export function useClassActivity(classId: Id<"classes">) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();

  const result = usePaginatedQuery(api.activity.list, isAuthenticated ? { classId } : "skip", {
    initialNumItems: CLASS_ACTIVITY_PAGE_SIZE,
  });

  return {
    ...result,
    isAuthLoading,
    isPending: isAuthLoading || result.status === "LoadingFirstPage",
  };
}
