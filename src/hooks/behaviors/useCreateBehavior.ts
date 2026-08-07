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
import { randomClientId } from "@/lib/optimistic";

type CreateBehaviorArgs = {
  classId: Id<"classes">;
  name: string;
  description?: string;
  icon?: string;
  points: number;
  folderId?: Id<"behaviorFolders">;
};

export function useCreateBehavior() {
  const { t } = useTranslation("behaviors");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.behaviors.create);

  return useOptimisticMutation({
    mutationFn: (args: CreateBehaviorArgs) => mutationFn(args),
    queryKeys: (args) => [
      behaviorsListQueryKey(args.classId),
      behaviorFoldersListQueryKey(args.classId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const behaviorsKey = behaviorsListQueryKey(args.classId);
      const foldersKey = behaviorFoldersListQueryKey(args.classId);
      const now = Date.now();
      const optimisticId = `optimistic:${randomClientId()}` as Id<"behaviors">;

      queryClient.setQueryData<BehaviorList>(behaviorsKey, (old) => {
        const next: BehaviorList[number] = {
          _id: optimisticId,
          _creationTime: now,
          classId: args.classId,
          folderId: args.folderId,
          name: args.name,
          description: args.description,
          icon: args.icon,
          points: args.points,
          createdBy: `optimistic:${randomClientId()}` as Id<"users">,
          createdAt: now,
          updatedAt: now,
          applicationCount: 0,
        };
        if (!old) return [next];
        return [...old, next].sort((a, b) => a.name.localeCompare(b.name));
      });

      if (args.folderId) {
        queryClient.setQueryData<BehaviorFolderList>(foldersKey, (old) => {
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
