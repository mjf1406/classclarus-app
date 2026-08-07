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
import { randomClientId } from "@/lib/optimistic";

type CreateRewardFolderArgs = {
  classId: Id<"classes">;
  name: string;
  description?: string;
  icon?: string;
  purchaseLimit?: PurchaseLimit;
};

export function useCreateRewardFolder() {
  const { t } = useTranslation("rewards");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.rewardFolders.create);

  return useOptimisticMutation({
    mutationFn: (args: CreateRewardFolderArgs) => mutationFn(args),
    queryKeys: (args) => [rewardFoldersListQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = rewardFoldersListQueryKey(args.classId);
      const now = Date.now();
      const optimisticId = `optimistic:${randomClientId()}` as Id<"rewardFolders">;
      queryClient.setQueryData<RewardFolderList>(queryKey, (old) => {
        const next: RewardFolderList[number] = {
          _id: optimisticId,
          _creationTime: now,
          classId: args.classId,
          name: args.name,
          description: args.description,
          icon: args.icon,
          purchaseLimit: args.purchaseLimit,
          createdBy: `optimistic:${randomClientId()}` as Id<"users">,
          createdAt: now,
          updatedAt: now,
          itemCount: 0,
        };
        if (!old) return [next];
        return [...old, next].sort((a, b) => a.name.localeCompare(b.name));
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
