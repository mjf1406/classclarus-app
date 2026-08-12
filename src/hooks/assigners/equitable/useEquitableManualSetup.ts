import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { EquitableGenderBucket } from "../../../../convex/lib/assigners/equitableGenderBuckets";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { ONE_HOUR } from "@/lib/queryCache";
import type { EquitableAssignerScope } from "@/lib/assigners/equitableAssigners";

export function equitableManualSetupQueryKey(
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners">,
  scope: EquitableAssignerScope,
  balanceGender: boolean,
  genderBuckets: EquitableGenderBucket[],
) {
  return convexQuery(api.equitableAssigners.manualSetup, {
    classId,
    assignerId,
    scope,
    balanceGender,
    genderBuckets,
  }).queryKey;
}

/** gcTime: ONE_HOUR — manual editor roster/slots; reactive via Convex. */
export function useEquitableManualSetup(
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners"> | undefined,
  scope: EquitableAssignerScope,
  balanceGender: boolean,
  genderBuckets: EquitableGenderBucket[],
) {
  return useAuthedQuery(
    api.equitableAssigners.manualSetup,
    assignerId ? { classId, assignerId, scope, balanceGender, genderBuckets } : "skip",
    { gcTime: ONE_HOUR },
  );
}
