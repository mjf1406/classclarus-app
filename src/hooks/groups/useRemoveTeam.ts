import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { groupsBoardQueryKey } from "@/hooks/groups/useGroupsBoard";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import type { GroupsBoard } from "@/lib/groups/groups";

type RemoveTeamArgs = {
  classId: Id<"classes">;
  teamId: Id<"teams">;
};

export function useRemoveTeam() {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.groups.removeTeam);

  return useOptimisticMutation({
    mutationFn: (args: RemoveTeamArgs) => mutationFn(args),
    queryKeys: (args) => [groupsBoardQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = groupsBoardQueryKey(args.classId);
      queryClient.setQueryData<GroupsBoard>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          groups: old.groups.map((group) => {
            const removed = group.teams.find((team) => team._id === args.teamId);
            if (!removed) return group;
            return {
              ...group,
              students: [...group.students, ...removed.students].sort((a, b) => {
                const nameA = (a.name ?? a.email ?? a.userId).toLocaleLowerCase();
                const nameB = (b.name ?? b.email ?? b.userId).toLocaleLowerCase();
                return nameA.localeCompare(nameB);
              }),
              teams: group.teams.filter((team) => team._id !== args.teamId),
            };
          }),
        };
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("teamsDeleteFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
