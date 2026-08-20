import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import {
  equitableAssignerRunsQueryKey,
  equitableAssignersListQueryKey,
  type EquitableAssignerList,
} from "@/hooks/assigners/equitable/useEquitableAssigners";
import { equitablePartnerHistoryQueryKeyPrefix } from "@/hooks/assigners/equitable/useEquitablePartnerHistory";
import { equitableRosterMatrixQueryKey } from "@/hooks/assigners/equitable/useEquitableRosterMatrix";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { EquitableAssignerScope } from "@/lib/assigners/equitableAssigners";
import type { EquitableGenderBucket } from "@/lib/assigners/equitableAssigners";
import type { EquitableManualDraftAssignment } from "@/lib/assigners/equitableManual";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";

type CreateEquitableManualRunArgs = {
  classId: Id<"classes">;
  assignerId: Id<"equitableAssigners">;
  scope: EquitableAssignerScope;
  balanceGender: boolean;
  genderBuckets: EquitableGenderBucket[];
  assignments: EquitableManualDraftAssignment[];
};

export function useCreateEquitableManualRun() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.equitableAssigners.createManualRun);

  return useOptimisticMutation({
    mutationFn: (args: CreateEquitableManualRunArgs) =>
      mutationFn({
        classId: args.classId,
        assignerId: args.assignerId,
        scope: args.scope,
        balanceGender: args.balanceGender,
        genderBuckets: args.genderBuckets,
        assignments: args.assignments,
      }),
    queryKeys: (args) => [
      equitableAssignersListQueryKey(args.classId),
      equitableAssignerRunsQueryKey(args.classId, args.assignerId),
      equitableRosterMatrixQueryKey(args.classId, args.assignerId),
    ],
    invalidateQueryKeys: (args) => [
      equitablePartnerHistoryQueryKeyPrefix(args.classId, args.assignerId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const now = Date.now();
      const optimisticRunId = `optimistic:${randomClientId()}` as Id<"equitableAssignerRuns">;

      queryClient.setQueryData<EquitableAssignerList>(
        equitableAssignersListQueryKey(args.classId),
        (old) => {
          if (!old) return old;
          return old.map((row) =>
            row._id === args.assignerId
              ? {
                  ...row,
                  runCount: row.runCount + 1,
                  latestRunId: optimisticRunId,
                  latestRunAt: now,
                }
              : row,
          );
        },
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("equitableManualSaveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
