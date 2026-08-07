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

type CreateTeamArgs = {
  classId: Id<"classes">;
  groupId: Id<"groups">;
  name: string;
  description?: string;
  icon?: string;
  alsoCreateInGroupIds?: Array<Id<"groups">>;
};

export function useCreateTeam() {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.groups.createTeam);

  return useOptimisticMutation({
    mutationFn: (args: CreateTeamArgs) => mutationFn(args),
    queryKeys: (args) => [groupsBoardQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = groupsBoardQueryKey(args.classId);
      const nameKey = args.name.toLocaleLowerCase();
      const alsoIds = new Set(args.alsoCreateInGroupIds ?? []);
      queryClient.setQueryData<GroupsBoard>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          groups: old.groups.map((group) => {
            const shouldAdd =
              group._id === args.groupId ||
              (alsoIds.has(group._id) &&
                !group.teams.some((team) => team.name.toLocaleLowerCase() === nameKey));
            if (!shouldAdd) return group;
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
        title: messageFromError(error, t("teamsSaveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
