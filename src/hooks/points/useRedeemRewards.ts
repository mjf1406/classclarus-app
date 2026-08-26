import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { pointsBoardQueryKey } from "@/hooks/points/usePointsBoard";
import { rewardPurchaseLimitsQueryKeyRoot } from "@/hooks/points/useRewardPurchaseLimits";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import { applyRewardRedemptionsToBoard, type PointsBoard } from "@/lib/points/points";
import { optimisticApplyRedemptionsToBoardQueries } from "@/lib/points/pointsBoardOptimistic";

type RedeemRewardsArgs = {
  classId: Id<"classes">;
  dateKey: string;
  studentUserIds: Array<Id<"users">>;
  items: Array<{ rewardId: Id<"rewards">; quantity: number; points: number }>;
  timeZoneOffsetMinutes: number;
  allowOverride?: boolean;
};

export function useRedeemRewards() {
  const { t } = useTranslation("points");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.points.redeemRewards);

  return useOptimisticMutation({
    mutationFn: (args: RedeemRewardsArgs) =>
      mutationFn.withOptimisticUpdate((localStore) => {
        optimisticApplyRedemptionsToBoardQueries(
          localStore,
          args.classId,
          args.studentUserIds,
          args.items,
        );
      })({
        classId: args.classId,
        studentUserIds: args.studentUserIds,
        items: args.items.map((item) => ({
          rewardId: item.rewardId,
          quantity: item.quantity,
        })),
        timeZoneOffsetMinutes: args.timeZoneOffsetMinutes,
        ...(args.allowOverride ? { allowOverride: true } : {}),
      }),
    queryKeys: (args) => [pointsBoardQueryKey(args.classId, args.dateKey)],
    invalidateQueryKeys: () => [rewardPurchaseLimitsQueryKeyRoot()],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = pointsBoardQueryKey(args.classId, args.dateKey);
      queryClient.setQueryData<PointsBoard>(queryKey, (old) => {
        if (!old) return old;
        return applyRewardRedemptionsToBoard(old, args.studentUserIds, args.items);
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("redeemFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
