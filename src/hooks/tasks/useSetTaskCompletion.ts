import { useConvexMutation } from "@convex-dev/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { assignmentDetailQueryKey } from "@/hooks/assignments/useAssignment";
import {
  assignmentProcedureTaskCompletionsQueryKey,
  type AssignmentProcedureTaskCompletions,
} from "@/hooks/assignments/useAssignmentProcedureTaskCompletions";
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
  /** Optional client hint so matrix/detail caches update when task detail is not loaded. */
  assignmentId?: Id<"assignments">;
};

function resolveLinkedAssignmentId(
  queryClient: ReturnType<typeof useQueryClient>,
  args: SetTaskCompletionArgs,
): Id<"assignments"> | undefined {
  if (args.assignmentId) {
    return args.assignmentId;
  }
  const detail = queryClient.getQueryData<TaskDetail | null>(
    taskDetailQueryKey(args.classId, args.taskId),
  );
  if (detail?.assignmentId) {
    return detail.assignmentId;
  }
  const list = queryClient.getQueryData<TaskList>(tasksListQueryKey(args.classId));
  return list?.find((item) => item._id === args.taskId)?.assignmentId;
}

function isStudentCompletedInCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  args: SetTaskCompletionArgs,
  assignmentId: Id<"assignments"> | undefined,
): boolean | undefined {
  const detail = queryClient.getQueryData<TaskDetail | null>(
    taskDetailQueryKey(args.classId, args.taskId),
  );
  if (detail && isClassTaskDetail(detail)) {
    return detail.completedStudentIds.includes(args.studentUserId);
  }
  if (!assignmentId) {
    return undefined;
  }
  const matrix = queryClient.getQueryData<AssignmentProcedureTaskCompletions | null>(
    assignmentProcedureTaskCompletionsQueryKey(args.classId, assignmentId),
  );
  const entry = matrix?.completionsByTaskId.find((row) => row.taskId === args.taskId);
  if (!entry) {
    return undefined;
  }
  return entry.completedStudentIds.includes(args.studentUserId);
}

export function useSetTaskCompletion() {
  const { t } = useTranslation("tasks");
  const { t: tCommon } = useTranslation("common");
  const queryClient = useQueryClient();
  const mutationFn = useConvexMutation(api.tasks.setCompletion);

  return useOptimisticMutation({
    mutationFn: (args: SetTaskCompletionArgs) =>
      mutationFn({
        classId: args.classId,
        taskId: args.taskId,
        studentUserId: args.studentUserId,
        completed: args.completed,
      }),
    queryKeys: (args) => {
      const assignmentId = resolveLinkedAssignmentId(queryClient, args);
      return [
        tasksListQueryKey(args.classId),
        taskDetailQueryKey(args.classId, args.taskId),
        ...(assignmentId
          ? [assignmentProcedureTaskCompletionsQueryKey(args.classId, assignmentId)]
          : []),
      ];
    },
    invalidateQueryKeys: (args) => {
      const assignmentId = resolveLinkedAssignmentId(queryClient, args);
      if (!assignmentId) return [];
      return [
        assignmentDetailQueryKey(args.classId, assignmentId),
        assignmentProcedureTaskCompletionsQueryKey(args.classId, assignmentId),
      ];
    },
    applyOptimisticUpdate: (queryClient, args) => {
      const assignmentId = resolveLinkedAssignmentId(queryClient, args);
      const alreadyCompleted = isStudentCompletedInCaches(queryClient, args, assignmentId);
      if (alreadyCompleted === undefined || alreadyCompleted === args.completed) {
        return;
      }

      const listKey = tasksListQueryKey(args.classId);
      const detailKey = taskDetailQueryKey(args.classId, args.taskId);

      queryClient.setQueryData<TaskDetail | null>(detailKey, (old) => {
        if (!old || !isClassTaskDetail(old)) {
          return old;
        }
        const completedStudentIds = args.completed
          ? [...old.completedStudentIds, args.studentUserId]
          : old.completedStudentIds.filter((id) => id !== args.studentUserId);
        return { ...old, completedStudentIds };
      });

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

      if (!assignmentId) {
        return;
      }
      const matrixKey = assignmentProcedureTaskCompletionsQueryKey(args.classId, assignmentId);
      queryClient.setQueryData<AssignmentProcedureTaskCompletions | null>(matrixKey, (old) => {
        if (!old) {
          return old;
        }
        return {
          ...old,
          completionsByTaskId: old.completionsByTaskId.map((row) => {
            if (row.taskId !== args.taskId) {
              return row;
            }
            const completedStudentIds = args.completed
              ? [...row.completedStudentIds, args.studentUserId]
              : row.completedStudentIds.filter((id) => id !== args.studentUserId);
            return { ...row, completedStudentIds };
          }),
        };
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
