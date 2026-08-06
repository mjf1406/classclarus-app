import { convexQuery } from "@convex-dev/react-query";

import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import type { MemberListRole } from "@/lib/members/members";
import { ONE_HOUR } from "@/lib/queryCache";
import { api } from "../../../convex/_generated/api";

export function classMembersByRoleQueryKey(classId: Id<"classes">, role: MemberListRole) {
  return convexQuery(api.members.listByRole, { classId, role }).queryKey;
}

export function useClassMembersByRole(classId: Id<"classes">, role: MemberListRole) {
  return useAuthedQuery(api.members.listByRole, { classId, role }, { gcTime: ONE_HOUR });
}
