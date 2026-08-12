import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { ONE_HOUR } from "@/lib/queryCache";
import type { EquitableAssignerScope } from "@/lib/assigners/equitableAssigners";

export function equitableStudentSummaryQueryKey(
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners">,
  studentUserId: Id<"users">,
  scope: EquitableAssignerScope,
  balanceGender: boolean,
  draftSlotId?: string,
) {
  return convexQuery(api.equitableAssigners.studentSummary, {
    classId,
    assignerId,
    studentUserId,
    scope,
    balanceGender,
    ...(draftSlotId ? { draftSlotId } : {}),
  }).queryKey;
}

/** gcTime: ONE_HOUR — student inspector stats for manual equitable editor. */
export function useEquitableStudentSummary(
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners"> | undefined,
  studentUserId: Id<"users"> | null,
  scope: EquitableAssignerScope,
  balanceGender: boolean,
  draftSlotId?: string | null,
) {
  return useAuthedQuery(
    api.equitableAssigners.studentSummary,
    assignerId && studentUserId
      ? {
          classId,
          assignerId,
          studentUserId,
          scope,
          balanceGender,
          ...(draftSlotId ? { draftSlotId } : {}),
        }
      : "skip",
    { gcTime: ONE_HOUR },
  );
}
