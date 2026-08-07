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

type RemoveRewardFolderArgs = {
  classId: Id<"classes">;
  folderId: Id<"rewardFolders">;
};

export function useRemoveRewardFolder() {
  const { t } = useTranslation("rewards");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.rewardFolders.remove);

  return useOptimisticMutation({
    mutationFn: (args: RemoveRewardFolderArgs) => mutationFn(args),
    queryKeys: (args) => [
      rewardFoldersListQueryKey(args.classId),
      rewardsListQueryKey(args.classId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const foldersKey = rewardFoldersListQueryKey(args.classId);
      const rewardsKey = rewardsListQueryKey(args.classId);
      const now = Date.now();

      queryClient.setQueryData<RewardFolderList>(foldersKey, (old) => {
        if (!old) return old;
        return old.filter((folder) => folder._id !== args.folderId);
      });

      queryClient.setQueryData<RewardList>(rewardsKey, (old) => {
        if (!old) return old;
        return old.map((reward) =>
          reward.folderId === args.folderId
            ? { ...reward, folderId: undefined, updatedAt: now }
            : reward,
        );
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("folderDeleteFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
