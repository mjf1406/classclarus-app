import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { rewardFoldersListQueryKey } from "@/hooks/rewardFolders/useRewardFolders";
import { rewardsListQueryKey } from "@/hooks/rewards/useRewards";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { RewardFolderList, RewardList } from "@/lib/rewards/rewards";
import { messageFromError } from "@/lib/errors/convexError";

type RemoveRewardArgs = {
  classId: Id<"classes">;
  rewardId: Id<"rewards">;
};

export function useRemoveReward() {
  const { t } = useTranslation("rewards");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.rewards.remove);

  return useOptimisticMutation({
    mutationFn: (args: RemoveRewardArgs) => mutationFn(args),
    queryKeys: (args) => [
      rewardsListQueryKey(args.classId),
      rewardFoldersListQueryKey(args.classId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const rewardsKey = rewardsListQueryKey(args.classId);
      const foldersKey = rewardFoldersListQueryKey(args.classId);

      let removedFolderId: Id<"rewardFolders"> | undefined;
      queryClient.setQueryData<RewardList>(rewardsKey, (old) => {
        if (!old) return old;
        const next: RewardList = [];
        for (const reward of old) {
          if (reward._id === args.rewardId) {
            removedFolderId = reward.folderId;
            continue;
          }
          next.push(reward);
        }
        return next;
      });

      if (removedFolderId) {
        queryClient.setQueryData<RewardFolderList>(foldersKey, (old) => {
          if (!old) return old;
          return old.map((folder) =>
            folder._id === removedFolderId
              ? { ...folder, itemCount: Math.max(0, folder.itemCount - 1) }
              : folder,
          );
        });
      }
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("deleteFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
