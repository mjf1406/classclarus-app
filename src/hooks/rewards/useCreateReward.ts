import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { rewardFoldersListQueryKey } from "@/hooks/rewardFolders/useRewardFolders";
import { rewardsListQueryKey } from "@/hooks/rewards/useRewards";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { PurchaseLimit } from "@/lib/rewards/purchaseLimit";
import type { RewardFolderList, RewardList } from "@/lib/rewards/rewards";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";

type CreateRewardArgs = {
  classId: Id<"classes">;
  name: string;
  description?: string;
  icon?: string;
  points: number;
  folderId?: Id<"rewardFolders">;
  purchaseLimit?: PurchaseLimit;
};

export function useCreateReward() {
  const { t } = useTranslation("rewards");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.rewards.create);

  return useOptimisticMutation({
    mutationFn: (args: CreateRewardArgs) => mutationFn(args),
    queryKeys: (args) => [
      rewardsListQueryKey(args.classId),
      rewardFoldersListQueryKey(args.classId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const rewardsKey = rewardsListQueryKey(args.classId);
      const foldersKey = rewardFoldersListQueryKey(args.classId);
      const now = Date.now();
      const optimisticId = `optimistic:${randomClientId()}` as Id<"rewards">;

      queryClient.setQueryData<RewardList>(rewardsKey, (old) => {
        const next: RewardList[number] = {
          _id: optimisticId,
          _creationTime: now,
          classId: args.classId,
          folderId: args.folderId,
          name: args.name,
          description: args.description,
          icon: args.icon,
          points: args.points,
          purchaseLimit: args.purchaseLimit,
          createdBy: `optimistic:${randomClientId()}` as Id<"users">,
          createdAt: now,
          updatedAt: now,
          purchaseCount: 0,
        };
        if (!old) return [next];
        return [...old, next].sort((a, b) => a.name.localeCompare(b.name));
      });

      if (args.folderId) {
        queryClient.setQueryData<RewardFolderList>(foldersKey, (old) => {
          if (!old) return old;
          return old.map((folder) =>
            folder._id === args.folderId ? { ...folder, itemCount: folder.itemCount + 1 } : folder,
          );
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
