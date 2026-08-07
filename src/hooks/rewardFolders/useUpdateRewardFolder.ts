import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { rewardFoldersListQueryKey } from "@/hooks/rewardFolders/useRewardFolders";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { PurchaseLimit } from "@/lib/rewards/purchaseLimit";
import type { RewardFolderList } from "@/lib/rewards/rewards";
import { messageFromError } from "@/lib/errors/convexError";

type UpdateRewardFolderArgs = {
  classId: Id<"classes">;
  folderId: Id<"rewardFolders">;
  name: string;
  description?: string;
  icon?: string;
  purchaseLimit?: PurchaseLimit;
};

export function useUpdateRewardFolder() {
  const { t } = useTranslation("rewards");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.rewardFolders.update);

  return useOptimisticMutation({
    mutationFn: (args: UpdateRewardFolderArgs) => mutationFn(args),
    queryKeys: (args) => [rewardFoldersListQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = rewardFoldersListQueryKey(args.classId);
      const now = Date.now();
      queryClient.setQueryData<RewardFolderList>(queryKey, (old) => {
        if (!old) return old;
        return old
          .map((folder) =>
            folder._id === args.folderId
              ? {
                  ...folder,
                  name: args.name,
                  description: args.description,
                  icon: args.icon,
                  purchaseLimit: args.purchaseLimit,
                  updatedAt: now,
                }
              : folder,
          )
          .sort((a, b) => a.name.localeCompare(b.name));
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("folderSaveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
