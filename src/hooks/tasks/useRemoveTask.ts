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

type RemoveTaskArgs = {
  classId: Id<"classes">;
  taskId: Id<"tasks">;
};

export function useRemoveTask() {
  const { t } = useTranslation("tasks");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.tasks.remove);

  return useOptimisticMutation({
    mutationFn: (args: RemoveTaskArgs) => mutationFn(args),
    queryKeys: (args) => [
      tasksListQueryKey(args.classId),
      taskDetailQueryKey(args.classId, args.taskId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const listKey = tasksListQueryKey(args.classId);
      const detailKey = taskDetailQueryKey(args.classId, args.taskId);
      queryClient.setQueryData<TaskList>(listKey, (old) => {
        if (!old) return old;
        return old.filter((item) => item._id !== args.taskId);
      });
      queryClient.setQueryData<TaskDetail | null>(detailKey, () => null);
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("deleteFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
