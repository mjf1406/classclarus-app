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

type RemoveBehaviorFolderArgs = {
  classId: Id<"classes">;
  folderId: Id<"behaviorFolders">;
};

export function useRemoveBehaviorFolder() {
  const { t } = useTranslation("behaviors");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.behaviorFolders.remove);

  return useOptimisticMutation({
    mutationFn: (args: RemoveBehaviorFolderArgs) => mutationFn(args),
    queryKeys: (args) => [
      behaviorFoldersListQueryKey(args.classId),
      behaviorsListQueryKey(args.classId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const foldersKey = behaviorFoldersListQueryKey(args.classId);
      const behaviorsKey = behaviorsListQueryKey(args.classId);
      const now = Date.now();

      queryClient.setQueryData<BehaviorFolderList>(foldersKey, (old) => {
        if (!old) return old;
        return old.filter((folder) => folder._id !== args.folderId);
      });

      queryClient.setQueryData<BehaviorList>(behaviorsKey, (old) => {
        if (!old) return old;
        return old.map((behavior) =>
          behavior.folderId === args.folderId
            ? { ...behavior, folderId: undefined, updatedAt: now }
            : behavior,
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
