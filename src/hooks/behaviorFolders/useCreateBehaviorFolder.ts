import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { behaviorFoldersListQueryKey } from "@/hooks/behaviorFolders/useBehaviorFolders";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { BehaviorFolderList } from "@/lib/behaviors/behaviors";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";

type CreateBehaviorFolderArgs = {
  classId: Id<"classes">;
  name: string;
  description?: string;
  icon?: string;
};

export function useCreateBehaviorFolder() {
  const { t } = useTranslation("behaviors");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.behaviorFolders.create);

  return useOptimisticMutation({
    mutationFn: (args: CreateBehaviorFolderArgs) => mutationFn(args),
    queryKeys: (args) => [behaviorFoldersListQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = behaviorFoldersListQueryKey(args.classId);
      const now = Date.now();
      const optimisticId = `optimistic:${randomClientId()}` as Id<"behaviorFolders">;
      queryClient.setQueryData<BehaviorFolderList>(queryKey, (old) => {
        const next: BehaviorFolderList[number] = {
          _id: optimisticId,
          _creationTime: now,
          classId: args.classId,
          name: args.name,
          description: args.description,
          icon: args.icon,
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
