import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { GC_TIME } from "@/lib/queryCache";

export function taskDetailQueryKey(classId: Id<"classes">, taskId: Id<"tasks">) {
  return convexQuery(api.tasks.get, { classId, taskId }).queryKey;
}

export function taskDetailQueryOptions(classId: Id<"classes">, taskId: Id<"tasks">) {
  return convexQuery(api.tasks.get, { classId, taskId });
}

/** gcTime: 5 minutes — reactive via Convex; moderate cache after unmount. */
export function useTask(classId: Id<"classes">, taskId: Id<"tasks">) {
  return useAuthedQuery(api.tasks.get, { classId, taskId }, { gcTime: GC_TIME.realtime });
}
