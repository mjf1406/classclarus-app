import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { GC_TIME } from "@/lib/queryCache";

export function behaviorFoldersListQueryKey(classId: Id<"classes">) {
  return convexQuery(api.behaviorFolders.list, { classId }).queryKey;
}

/** gcTime: 5 minutes — reactive via Convex; moderate cache after unmount. */
export function useBehaviorFolders(classId: Id<"classes">) {
  return useAuthedQuery(api.behaviorFolders.list, { classId }, { gcTime: GC_TIME.realtime });
}
