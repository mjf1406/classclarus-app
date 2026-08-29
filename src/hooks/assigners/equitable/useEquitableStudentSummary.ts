import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { EquitableGenderBucket } from "../../../../convex/lib/assigners/equitableGenderBuckets";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import type { EquitableAssignerScope } from "@/lib/assigners/equitableAssigners";
import { GC_TIME } from "@/lib/queryCache";

export function equitableStudentSummaryQueryKey(
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners">,
  studentUserId: Id<"users">,
  scope: EquitableAssignerScope,
  balanceGender: boolean,
  genderBuckets: EquitableGenderBucket[],
  draftSlotId?: string,
) {
  return convexQuery(api.equitableAssigners.studentSummary, {
    classId,
    assignerId,
    studentUserId,
    scope,
    balanceGender,
    genderBuckets,
    ...(draftSlotId ? { draftSlotId } : {}),
  }).queryKey;
}

/** gcTime: GC_TIME.realtime — student inspector stats for manual equitable editor. */
export function useEquitableStudentSummary(
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners"> | undefined,
  studentUserId: Id<"users"> | null,
  scope: EquitableAssignerScope,
  balanceGender: boolean,
  genderBuckets: EquitableGenderBucket[],
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
          genderBuckets,
          ...(draftSlotId ? { draftSlotId } : {}),
        }
      : "skip",
    { gcTime: GC_TIME.realtime },
  );
}
