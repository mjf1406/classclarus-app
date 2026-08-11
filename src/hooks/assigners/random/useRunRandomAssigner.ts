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
import type { RandomAssignerScope } from "@/lib/assigners/randomAssigners";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";

type RunRandomAssignerArgs = {
  classId: Id<"classes">;
  assignerId: Id<"randomAssigners">;
  scope: RandomAssignerScope;
  replicates: boolean;
};

export function useRunRandomAssigner() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.randomAssigners.run);

  return useOptimisticMutation({
    mutationFn: (args: RunRandomAssignerArgs) =>
      mutationFn({
        classId: args.classId,
        assignerId: args.assignerId,
        scope: args.scope,
        replicates: args.replicates,
      }),
    queryKeys: (args) => [
      randomAssignersListQueryKey(args.classId),
      randomAssignerRunsQueryKey(args.classId, args.assignerId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const now = Date.now();
      const optimisticRunId = `optimistic:${randomClientId()}` as Id<"randomAssignerRuns">;

      queryClient.setQueryData<RandomAssignerList>(
        randomAssignersListQueryKey(args.classId),
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
        title: messageFromError(error, t("randomRunFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
