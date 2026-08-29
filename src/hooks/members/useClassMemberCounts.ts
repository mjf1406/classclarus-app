import { convexQuery } from "@convex-dev/react-query";

import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { api } from "../../../convex/_generated/api";
import { GC_TIME } from "@/lib/queryCache";

export function classMemberCountsQueryKey(classId: Id<"classes">) {
  return convexQuery(api.members.countsByRole, { classId }).queryKey;
}

export function classMemberCountsQueryOptions(classId: Id<"classes">) {
  return convexQuery(api.members.countsByRole, { classId });
}

export function useClassMemberCounts(classId: Id<"classes">) {
  return useAuthedQuery(api.members.countsByRole, { classId }, { gcTime: GC_TIME.realtime });
}
