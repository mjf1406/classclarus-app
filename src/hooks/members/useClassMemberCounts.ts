import { convexQuery } from "@convex-dev/react-query";

import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { ONE_HOUR } from "@/lib/queryCache";
import { api } from "../../../convex/_generated/api";

export function classMemberCountsQueryKey(classId: Id<"classes">) {
  return convexQuery(api.members.countsByRole, { classId }).queryKey;
}

export function useClassMemberCounts(classId: Id<"classes">) {
  return useAuthedQuery(api.members.countsByRole, { classId }, { gcTime: ONE_HOUR });
}
