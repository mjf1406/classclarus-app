import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { behaviorFoldersListQueryKey } from "@/hooks/behaviorFolders/useBehaviorFolders";
import { behaviorsListQueryKey } from "@/hooks/behaviors/useBehaviors";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { BehaviorFolderList, BehaviorList, PointsApplyMode } from "@/lib/behaviors/behaviors";
import { messageFromError } from "@/lib/errors/convexError";

type UpdateBehaviorArgs = {
  classId: Id<"classes">;
  behaviorId: Id<"behaviors">;
  name: string;
  description?: string;
  icon?: string;
  points: number;
  folderId?: Id<"behaviorFolders">;
  pointsApplyMode?: PointsApplyMode;
};

export function useUpdateBehavior() {
  const { t } = useTranslation("behaviors");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.behaviors.update);

  return useOptimisticMutation({
    mutationFn: (args: UpdateBehaviorArgs) => mutationFn(args),
    queryKeys: (args) => [
      behaviorsListQueryKey(args.classId),
      behaviorFoldersListQueryKey(args.classId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const behaviorsKey = behaviorsListQueryKey(args.classId);
      const foldersKey = behaviorFoldersListQueryKey(args.classId);
      const now = Date.now();

      let previousFolderId: Id<"behaviorFolders"> | undefined;
      queryClient.setQueryData<BehaviorList>(behaviorsKey, (old) => {
        if (!old) return old;
        return old
          .map((behavior) => {
            if (behavior._id !== args.behaviorId) return behavior;
            previousFolderId = behavior.folderId;
            return {
              ...behavior,
              name: args.name,
              description: args.description,
              icon: args.icon,
              points: args.points,
              folderId: args.folderId,
              updatedAt: now,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
      });

      if (previousFolderId !== args.folderId) {
        queryClient.setQueryData<BehaviorFolderList>(foldersKey, (old) => {
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
