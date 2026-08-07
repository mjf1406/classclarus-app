import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { taskDetailQueryKey } from "@/hooks/tasks/useTask";
import { tasksListQueryKey } from "@/hooks/tasks/useTasks";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import type { TaskDetail, TaskList } from "@/lib/tasks/tasks";

type UpdateTaskArgs = {
  classId: Id<"classes">;
  taskId: Id<"tasks">;
  name: string;
  description?: string;
  dueDateKey?: string;
};

export function useUpdateTask() {
  const { t } = useTranslation("tasks");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.tasks.update);

  return useOptimisticMutation({
    mutationFn: (args: UpdateTaskArgs) => mutationFn(args),
    queryKeys: (args) => [
      tasksListQueryKey(args.classId),
      taskDetailQueryKey(args.classId, args.taskId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const now = Date.now();
      const listKey = tasksListQueryKey(args.classId);
      const detailKey = taskDetailQueryKey(args.classId, args.taskId);

      queryClient.setQueryData<TaskList>(listKey, (old) => {
        if (!old) return old;
        return old.map((item) =>
          item._id === args.taskId
            ? {
                ...item,
                name: args.name,
                description: args.description,
                dueDateKey: args.dueDateKey,
                updatedAt: now,
              }
            : item,
        );
      });

      queryClient.setQueryData<TaskDetail | null>(detailKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          name: args.name,
          description: args.description,
          dueDateKey: args.dueDateKey,
          updatedAt: now,
        };
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("saveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
