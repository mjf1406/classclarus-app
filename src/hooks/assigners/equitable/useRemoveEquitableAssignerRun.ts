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
import { equitableRosterMatrixQueryKey } from "@/hooks/assigners/equitable/useEquitableRosterMatrix";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";

type RemoveEquitableAssignerRunArgs = {
  classId: Id<"classes">;
  assignerId: Id<"equitableAssigners">;
  runId: Id<"equitableAssignerRuns">;
};

export function useRemoveEquitableAssignerRun() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.equitableAssigners.removeRun);

  return useOptimisticMutation({
    mutationFn: (args: RemoveEquitableAssignerRunArgs) =>
      mutationFn({
        classId: args.classId,
        assignerId: args.assignerId,
        runId: args.runId,
      }),
    queryKeys: (args) => [
      equitableAssignersListQueryKey(args.classId),
      equitableAssignerRunsQueryKey(args.classId, args.assignerId),
      equitableRosterMatrixQueryKey(args.classId, args.assignerId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      queryClient.setQueryData<EquitableAssignerList>(
        equitableAssignersListQueryKey(args.classId),
        (old) => {
          if (!old) return old;
          return old.map((row) => {
            if (row._id !== args.assignerId) return row;
            const nextRunCount = Math.max(0, row.runCount - 1);
            const clearedLatest = row.latestRunId === args.runId;
            return {
              ...row,
              runCount: nextRunCount,
              latestRunId: clearedLatest ? null : row.latestRunId,
              latestRunAt: clearedLatest ? null : row.latestRunAt,
            };
          });
        },
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("equitableRunDeleteFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
