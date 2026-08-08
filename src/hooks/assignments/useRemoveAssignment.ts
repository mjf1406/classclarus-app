import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { assignmentDetailQueryKey } from "@/hooks/assignments/useAssignment";
import { assignmentsListQueryKey } from "@/hooks/assignments/useAssignments";
import { tasksListQueryKey } from "@/hooks/tasks/useTasks";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { AssignmentDetail, AssignmentList } from "@/lib/assignments/assignments";
import { messageFromError } from "@/lib/errors/convexError";
import type { TaskList } from "@/lib/tasks/tasks";

type RemoveAssignmentArgs = {
  classId: Id<"classes">;
  assignmentId: Id<"assignments">;
};

export function useRemoveAssignment() {
  const { t } = useTranslation("assignments");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.assignments.remove);

  return useOptimisticMutation({
    mutationFn: (args: RemoveAssignmentArgs) => mutationFn(args),
    queryKeys: (args) => [
      assignmentsListQueryKey(args.classId),
      assignmentDetailQueryKey(args.classId, args.assignmentId),
      tasksListQueryKey(args.classId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const listKey = assignmentsListQueryKey(args.classId);
      const detailKey = assignmentDetailQueryKey(args.classId, args.assignmentId);
      const tasksKey = tasksListQueryKey(args.classId);
      queryClient.setQueryData<AssignmentList>(listKey, (old) => {
        if (!old) return old;
        return old.filter((item) => item._id !== args.assignmentId);
      });
      queryClient.setQueryData<AssignmentDetail | null>(detailKey, () => null);
      queryClient.setQueryData<TaskList>(tasksKey, (old) => {
        if (!old) return old;
        return old.filter((task) => task.assignmentId !== args.assignmentId);
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("deleteFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
