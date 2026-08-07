import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { groupsBoardQueryKey } from "@/hooks/groups/useGroupsBoard";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import type { GroupsBoard } from "@/lib/groups/groups";

type UpdateGroupArgs = {
  classId: Id<"classes">;
  groupId: Id<"groups">;
  name: string;
  description?: string;
  icon?: string;
};

export function useUpdateGroup() {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.groups.updateGroup);

  return useOptimisticMutation({
    mutationFn: (args: UpdateGroupArgs) => mutationFn(args),
    queryKeys: (args) => [groupsBoardQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = groupsBoardQueryKey(args.classId);
      queryClient.setQueryData<GroupsBoard>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          groups: old.groups
            .map((group) =>
              group._id === args.groupId
                ? {
                    ...group,
                    name: args.name,
                    description: args.description,
                    icon: args.icon,
                    updatedAt: Date.now(),
                  }
                : group,
            )
            .sort((a, b) => a.name.localeCompare(b.name)),
        };
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("groupsSaveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
