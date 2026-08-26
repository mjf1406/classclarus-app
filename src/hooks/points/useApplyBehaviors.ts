import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { pointsBoardQueryKey } from "@/hooks/points/usePointsBoard";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import { applyBehaviorItemsToBoard, type PointsBoard } from "@/lib/points/points";
import { optimisticApplyBehaviorsToBoardQueries } from "@/lib/points/pointsBoardOptimistic";

type ApplyBehaviorsArgs = {
  classId: Id<"classes">;
  dateKey: string;
  studentUserIds: Array<Id<"users">>;
  mode: "award" | "remove";
  items: Array<{ behaviorId: Id<"behaviors">; quantity: number; points: number }>;
  note?: string;
};

export function useApplyBehaviors() {
  const { t } = useTranslation("points");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.points.applyBehaviors);

  return useOptimisticMutation({
    mutationFn: (args: ApplyBehaviorsArgs) =>
      mutationFn.withOptimisticUpdate((localStore) => {
        optimisticApplyBehaviorsToBoardQueries(
          localStore,
          args.classId,
          args.studentUserIds,
          args.items,
        );
      })({
        classId: args.classId,
        studentUserIds: args.studentUserIds,
        mode: args.mode,
        items: args.items.map((item) => ({
          behaviorId: item.behaviorId,
          quantity: item.quantity,
        })),
        ...(args.note ? { note: args.note } : {}),
      }),
    queryKeys: (args) => [pointsBoardQueryKey(args.classId, args.dateKey)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = pointsBoardQueryKey(args.classId, args.dateKey);
      queryClient.setQueryData<PointsBoard>(queryKey, (old) => {
        if (!old) return old;
        return applyBehaviorItemsToBoard(old, args.studentUserIds, args.items);
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("applyFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
