import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { groupsBoardQueryKey } from "@/hooks/groups/useGroupsBoard";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import { sortStudents, type GroupsBoard } from "@/lib/groups/groups";

type RemoveGroupArgs = {
  classId: Id<"classes">;
  groupId: Id<"groups">;
};

export function useRemoveGroup() {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.groups.removeGroup);

  return useOptimisticMutation({
    mutationFn: (args: RemoveGroupArgs) => mutationFn(args),
    queryKeys: (args) => [groupsBoardQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = groupsBoardQueryKey(args.classId);
      queryClient.setQueryData<GroupsBoard>(queryKey, (old) => {
        if (!old) return old;
        const removed = old.groups.find((group) => group._id === args.groupId);
        if (!removed) return old;
        const released = [...removed.students, ...removed.teams.flatMap((team) => team.students)];
        return {
          ungrouped: sortStudents([...old.ungrouped, ...released]),
          groups: old.groups.filter((group) => group._id !== args.groupId),
        };
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("groupsDeleteFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
