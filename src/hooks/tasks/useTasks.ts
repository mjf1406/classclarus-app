import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { GC_TIME } from "@/lib/queryCache";

export function tasksListQueryKey(classId: Id<"classes">) {
  return convexQuery(api.tasks.list, { classId }).queryKey;
}

export function tasksListQueryOptions(classId: Id<"classes">) {
  return convexQuery(api.tasks.list, { classId });
}

/** gcTime: 5 minutes — reactive via Convex; moderate cache after unmount. */
export function useTasks(classId: Id<"classes">) {
  return useAuthedQuery(api.tasks.list, { classId }, { gcTime: GC_TIME.realtime });
}
