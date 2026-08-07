import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { rewardFoldersListQueryKey } from "@/hooks/rewardFolders/useRewardFolders";
import { rewardsListQueryKey } from "@/hooks/rewards/useRewards";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { PurchaseLimit } from "@/lib/rewards/purchaseLimit";
import type { PointsApplyMode, RewardFolderList, RewardList } from "@/lib/rewards/rewards";
import { messageFromError } from "@/lib/errors/convexError";

type UpdateRewardArgs = {
  classId: Id<"classes">;
  rewardId: Id<"rewards">;
  name: string;
  description?: string;
  icon?: string;
  points: number;
  folderId?: Id<"rewardFolders">;
  purchaseLimit?: PurchaseLimit;
  pointsApplyMode?: PointsApplyMode;
};

export function useUpdateReward() {
  const { t } = useTranslation("rewards");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.rewards.update);

  return useOptimisticMutation({
    mutationFn: (args: UpdateRewardArgs) => mutationFn(args),
    queryKeys: (args) => [
      rewardsListQueryKey(args.classId),
      rewardFoldersListQueryKey(args.classId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const rewardsKey = rewardsListQueryKey(args.classId);
      const foldersKey = rewardFoldersListQueryKey(args.classId);
      const now = Date.now();

      let previousFolderId: Id<"rewardFolders"> | undefined;
      queryClient.setQueryData<RewardList>(rewardsKey, (old) => {
        if (!old) return old;
        return old
          .map((reward) => {
            if (reward._id !== args.rewardId) return reward;
            previousFolderId = reward.folderId;
            return {
              ...reward,
              name: args.name,
              description: args.description,
              icon: args.icon,
              points: args.points,
              folderId: args.folderId,
              purchaseLimit: args.purchaseLimit,
              updatedAt: now,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
      });

      if (previousFolderId !== args.folderId) {
        queryClient.setQueryData<RewardFolderList>(foldersKey, (old) => {
          if (!old) return old;
          return old.map((folder) => {
            let itemCount = folder.itemCount;
            if (previousFolderId && folder._id === previousFolderId) {
              itemCount = Math.max(0, itemCount - 1);
            }
            if (args.folderId && folder._id === args.folderId) {
              itemCount += 1;
            }
            return { ...folder, itemCount };
          });
        });
      }
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("saveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
