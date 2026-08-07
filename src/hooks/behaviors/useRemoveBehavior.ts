import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { behaviorFoldersListQueryKey } from "@/hooks/behaviorFolders/useBehaviorFolders";
import { behaviorsListQueryKey } from "@/hooks/behaviors/useBehaviors";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { BehaviorFolderList, BehaviorList } from "@/lib/behaviors/behaviors";
import { messageFromError } from "@/lib/errors/convexError";

type RemoveBehaviorArgs = {
  classId: Id<"classes">;
  behaviorId: Id<"behaviors">;
};

export function useRemoveBehavior() {
  const { t } = useTranslation("behaviors");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.behaviors.remove);

  return useOptimisticMutation({
    mutationFn: (args: RemoveBehaviorArgs) => mutationFn(args),
    queryKeys: (args) => [
      behaviorsListQueryKey(args.classId),
      behaviorFoldersListQueryKey(args.classId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const behaviorsKey = behaviorsListQueryKey(args.classId);
      const foldersKey = behaviorFoldersListQueryKey(args.classId);

      let removedFolderId: Id<"behaviorFolders"> | undefined;
      queryClient.setQueryData<BehaviorList>(behaviorsKey, (old) => {
        if (!old) return old;
        const next: BehaviorList = [];
        for (const behavior of old) {
          if (behavior._id === args.behaviorId) {
            removedFolderId = behavior.folderId;
            continue;
          }
          next.push(behavior);
        }
        return next;
      });

      if (removedFolderId) {
        queryClient.setQueryData<BehaviorFolderList>(foldersKey, (old) => {
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
