import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";

const ONE_HOUR = 60 * 60 * 1000;

export function groupsBoardQueryKey(classId: Id<"classes">) {
  return convexQuery(api.groups.board, { classId }).queryKey;
}

export function useGroupsBoard(classId: Id<"classes">) {
  return useAuthedQuery(api.groups.board, { classId }, { gcTime: ONE_HOUR });
}
