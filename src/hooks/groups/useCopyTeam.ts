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

type CopyTeamArgs = {
  classId: Id<"classes">;
  teamId: Id<"teams">;
  sourceGroupId: Id<"groups">;
  name: string;
  description?: string;
  icon?: string;
  targetGroupIds: Array<Id<"groups">>;
};

export function useCopyTeam() {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.groups.copyTeam);

  return useOptimisticMutation({
    mutationFn: (args: CopyTeamArgs) =>
      mutationFn({
        classId: args.classId,
        teamId: args.teamId,
        targetGroupIds: args.targetGroupIds,
      }),
    queryKeys: (args) => [groupsBoardQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = groupsBoardQueryKey(args.classId);
      const nameKey = args.name.toLocaleLowerCase();
      const targets = new Set(args.targetGroupIds.filter((id) => id !== args.sourceGroupId));
      queryClient.setQueryData<GroupsBoard>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          groups: old.groups.map((group) => {
            if (!targets.has(group._id)) return group;
            if (group.teams.some((team) => team.name.toLocaleLowerCase() === nameKey)) {
              return group;
            }
            const team = {
              _id: `optimistic:${randomClientId()}` as Id<"teams">,
              groupId: group._id,
              name: args.name,
              description: args.description,
              icon: args.icon,
              updatedAt: Date.now(),
              students: [],
            };
            return {
              ...group,
              teams: [...group.teams, team].sort((a, b) => a.name.localeCompare(b.name)),
            };
          }),
        };
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("teamsCopyFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
