import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { behaviorFoldersListQueryKey } from "@/hooks/behaviorFolders/useBehaviorFolders";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { BehaviorFolderList } from "@/lib/behaviors/behaviors";
import { messageFromError } from "@/lib/errors/convexError";

type UpdateBehaviorFolderArgs = {
  classId: Id<"classes">;
  folderId: Id<"behaviorFolders">;
  name: string;
  description?: string;
  icon?: string;
};

export function useUpdateBehaviorFolder() {
  const { t } = useTranslation("behaviors");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.behaviorFolders.update);

  return useOptimisticMutation({
    mutationFn: (args: UpdateBehaviorFolderArgs) => mutationFn(args),
    queryKeys: (args) => [behaviorFoldersListQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = behaviorFoldersListQueryKey(args.classId);
      const now = Date.now();
      queryClient.setQueryData<BehaviorFolderList>(queryKey, (old) => {
        if (!old) return old;
        return old
          .map((folder) =>
            folder._id === args.folderId
              ? {
                  ...folder,
                  name: args.name,
                  description: args.description,
                  icon: args.icon,
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
