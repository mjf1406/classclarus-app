import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { groupsBoardQueryKey } from "@/hooks/groups/useGroupsBoard";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import type { GroupsBoard } from "@/lib/groups/groups";
import { randomClientId } from "@/lib/optimistic";

type CreateGroupArgs = {
  classId: Id<"classes">;
  name: string;
  description?: string;
  icon?: string;
};

export function useCreateGroup() {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.groups.createGroup);

  return useOptimisticMutation({
    mutationFn: (args: CreateGroupArgs) => mutationFn(args),
    queryKeys: (args) => [groupsBoardQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = groupsBoardQueryKey(args.classId);
      const optimisticId = `optimistic:${randomClientId()}` as Id<"groups">;
      queryClient.setQueryData<GroupsBoard>(queryKey, (old) => {
        if (!old) return old;
        const group = {
          _id: optimisticId,
          name: args.name,
          description: args.description,
          icon: args.icon,
          updatedAt: Date.now(),
          students: [],
          teams: [],
        };
        return {
          ...old,
          groups: [...old.groups, group].sort((a, b) => a.name.localeCompare(b.name)),
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
