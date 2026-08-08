import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { pointsBoardQueryKey } from "@/hooks/points/usePointsBoard";
import { rewardPurchaseLimitsQueryKeyRoot } from "@/hooks/points/useRewardPurchaseLimits";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";

type UndoLastPointsActionArgs = {
  classId: Id<"classes">;
  dateKey: string;
  studentUserId: Id<"users">;
};

export function useUndoLastPointsAction() {
  const { t } = useTranslation("points");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.points.undoLastPointsAction);

  return useOptimisticMutation({
    mutationFn: (args: UndoLastPointsActionArgs) =>
      mutationFn({
        classId: args.classId,
        studentUserId: args.studentUserId,
      }),
    queryKeys: (args) => [pointsBoardQueryKey(args.classId, args.dateKey)],
    invalidateQueryKeys: () => [rewardPurchaseLimitsQueryKeyRoot()],
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("undoPointsFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
