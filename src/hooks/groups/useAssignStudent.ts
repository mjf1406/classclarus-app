import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { groupsBoardQueryKey } from "@/hooks/groups/useGroupsBoard";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import { moveStudentOnBoard, type DropTarget, type GroupsBoard } from "@/lib/groups/groups";

type AssignStudentArgs = {
  classId: Id<"classes">;
  studentUserId: Id<"users">;
  target: DropTarget;
};

function toMutationArgs(args: AssignStudentArgs) {
  if (args.target.kind === "ungrouped") {
    return {
      classId: args.classId,
      studentUserId: args.studentUserId,
      groupId: null,
      teamId: null,
    };
  }
  if (args.target.kind === "group") {
    return {
      classId: args.classId,
      studentUserId: args.studentUserId,
      groupId: args.target.groupId,
      teamId: null,
    };
  }
  return {
    classId: args.classId,
    studentUserId: args.studentUserId,
    groupId: args.target.groupId,
    teamId: args.target.teamId,
  };
}

export function useAssignStudent() {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.groups.assignStudent);

  return useOptimisticMutation({
    mutationFn: (args: AssignStudentArgs) => mutationFn(toMutationArgs(args)),
    queryKeys: (args) => [groupsBoardQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = groupsBoardQueryKey(args.classId);
      queryClient.setQueryData<GroupsBoard>(queryKey, (old) => {
        if (!old) return old;
        return moveStudentOnBoard(old, args.studentUserId, args.target);
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("groupsAssignFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
