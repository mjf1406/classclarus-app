import { useMemo } from "react";
import { convexQuery } from "@convex-dev/react-query";

import type { Id } from "../../../convex/_generated/dataModel";
import { useLogClassAccessOnce } from "@/hooks/activity/useLogClassAccess";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import type { MemberListRole } from "@/lib/members/members";
import { ONE_HOUR } from "@/lib/queryCache";
import { api } from "../../../convex/_generated/api";

export function classMembersByRoleQueryKey(classId: Id<"classes">, role: MemberListRole) {
  return convexQuery(api.members.listByRole, { classId, role }).queryKey;
}

export function useClassMembersByRole(classId: Id<"classes">, role: MemberListRole) {
  const result = useAuthedQuery(api.members.listByRole, { classId, role }, { gcTime: ONE_HOUR });
  const accessArgs = useMemo(
    () =>
      result.data !== undefined
        ? {
            classId,
            resourceType: "member",
            resourceId: role,
            summary: `Viewed ${role} member list`,
            summaryKey: "activitySummary_viewedMemberList",
            metadata: { role },
          }
        : null,
    [classId, role, result.data],
  );
  useLogClassAccessOnce(result.data !== undefined, accessArgs);
  return result;
}
