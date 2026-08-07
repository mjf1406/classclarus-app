import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { groupsBoardQueryKey } from "@/hooks/groups/useGroupsBoard";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import { moveStudentsOnBoard, type GroupsBoard } from "@/lib/groups/groups";

type AssignStudentsArgs = {
  classId: Id<"classes">;
  groupId: Id<"groups">;
  studentUserIds: Array<Id<"users">>;
};

export function useAssignStudents() {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.groups.assignStudents);

  return useOptimisticMutation({
    mutationFn: (args: AssignStudentsArgs) =>
      mutationFn({
        classId: args.classId,
        groupId: args.groupId,
        studentUserIds: args.studentUserIds,
      }),
    queryKeys: (args) => [groupsBoardQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = groupsBoardQueryKey(args.classId);
      queryClient.setQueryData<GroupsBoard>(queryKey, (old) => {
        if (!old) return old;
        return moveStudentsOnBoard(old, args.studentUserIds, {
          kind: "group",
          groupId: args.groupId,
        });
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("groupsMoveStudentsFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
