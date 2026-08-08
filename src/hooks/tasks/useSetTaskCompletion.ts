import { useConvexMutation } from "@convex-dev/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { assignmentDetailQueryKey } from "@/hooks/assignments/useAssignment";
import { taskDetailQueryKey } from "@/hooks/tasks/useTask";
import { tasksListQueryKey } from "@/hooks/tasks/useTasks";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import { isClassTaskDetail, type TaskDetail, type TaskList } from "@/lib/tasks/tasks";

type SetTaskCompletionArgs = {
  classId: Id<"classes">;
  taskId: Id<"tasks">;
  studentUserId: Id<"users">;
  completed: boolean;
};

export function useSetTaskCompletion() {
  const { t } = useTranslation("tasks");
  const { t: tCommon } = useTranslation("common");
  const queryClient = useQueryClient();
  const mutationFn = useConvexMutation(api.tasks.setCompletion);

  return useOptimisticMutation({
    mutationFn: (args: SetTaskCompletionArgs) => mutationFn(args),
    queryKeys: (args) => [
      tasksListQueryKey(args.classId),
      taskDetailQueryKey(args.classId, args.taskId),
    ],
    invalidateQueryKeys: (args) => {
      const detail = queryClient.getQueryData<TaskDetail | null>(
        taskDetailQueryKey(args.classId, args.taskId),
      );
      if (!detail?.assignmentId) return [];
      return [assignmentDetailQueryKey(args.classId, detail.assignmentId)];
    },
    applyOptimisticUpdate: (queryClient, args) => {
      const listKey = tasksListQueryKey(args.classId);
      const detailKey = taskDetailQueryKey(args.classId, args.taskId);
      const detail = queryClient.getQueryData<TaskDetail | null>(detailKey);
      if (!detail || !isClassTaskDetail(detail)) {
        return;
      }
      const alreadyCompleted = detail.completedStudentIds.includes(args.studentUserId);
      if (alreadyCompleted === args.completed) {
        return;
      }

      const completedStudentIds = args.completed
        ? [...detail.completedStudentIds, args.studentUserId]
        : detail.completedStudentIds.filter((id) => id !== args.studentUserId);
      queryClient.setQueryData<TaskDetail | null>(detailKey, (old) =>
        old && isClassTaskDetail(old) ? { ...old, completedStudentIds } : old,
      );

      queryClient.setQueryData<TaskList>(listKey, (old) => {
        if (!old) return old;
        return old.map((item) => {
          if (item._id !== args.taskId) return item;
          const nextCount = args.completed
            ? Math.min(item.studentCount, item.completedCount + 1)
            : Math.max(0, item.completedCount - 1);
          return { ...item, completedCount: nextCount };
        });
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("completeFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
