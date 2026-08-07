import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { fileBytesQueryKey } from "@/hooks/files/useFileBytes";
import { groupsBoardQueryKey } from "@/hooks/groups/useGroupsBoard";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import type { GroupsBoard } from "@/lib/groups/groups";

type ClearGroupImageArgs = {
  classId: Id<"classes">;
  groupId: Id<"groups">;
};

export function useClearGroupImage() {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.groups.clearGroupImage);

  return useOptimisticMutation({
    mutationFn: (args: ClearGroupImageArgs) =>
      mutationFn({
        classId: args.classId,
        groupId: args.groupId,
      }),
    queryKeys: (args) => [groupsBoardQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = groupsBoardQueryKey(args.classId);
      const previous = queryClient.getQueryData<GroupsBoard>(queryKey);
      const previousImageId = previous?.groups.find(
        (group) => group._id === args.groupId,
      )?.imageFileId;
      if (previousImageId !== undefined) {
        void queryClient.removeQueries({ queryKey: fileBytesQueryKey(previousImageId) });
      }
      const now = Date.now();
      queryClient.setQueryData<GroupsBoard>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          groups: old.groups.map((group) =>
            group._id === args.groupId
              ? { ...group, imageFileId: undefined, updatedAt: now }
              : group,
          ),
        };
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("groupsImageClearFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
