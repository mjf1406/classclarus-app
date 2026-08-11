import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import {
  randomAssignerRunsQueryKey,
  randomAssignersListQueryKey,
  type RandomAssignerList,
} from "@/hooks/assigners/random/useRandomAssigners";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";

type RemoveRandomAssignerRunArgs = {
  classId: Id<"classes">;
  assignerId: Id<"randomAssigners">;
  runId: Id<"randomAssignerRuns">;
};

export function useRemoveRandomAssignerRun() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.randomAssigners.removeRun);

  return useOptimisticMutation({
    mutationFn: (args: RemoveRandomAssignerRunArgs) =>
      mutationFn({
        classId: args.classId,
        assignerId: args.assignerId,
        runId: args.runId,
      }),
    queryKeys: (args) => [
      randomAssignersListQueryKey(args.classId),
      randomAssignerRunsQueryKey(args.classId, args.assignerId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      queryClient.setQueryData<RandomAssignerList>(
        randomAssignersListQueryKey(args.classId),
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
        title: messageFromError(error, t("randomRunDeleteFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
