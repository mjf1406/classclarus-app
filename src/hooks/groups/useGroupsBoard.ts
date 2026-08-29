import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { GC_TIME } from "@/lib/queryCache";

export function groupsBoardQueryKey(classId: Id<"classes">) {
  return convexQuery(api.groups.board, { classId }).queryKey;
}

export function groupsBoardQueryOptions(classId: Id<"classes">) {
  return convexQuery(api.groups.board, { classId });
}

export function useGroupsBoard(classId: Id<"classes">) {
  return useAuthedQuery(api.groups.board, { classId }, { gcTime: GC_TIME.realtime });
}
