import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { tasksListQueryKey } from "@/hooks/tasks/useTasks";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import { applyTaskTopLevelOrder, type TaskList, type TaskReorderItem } from "@/lib/tasks/tasks";

export type ReorderTasksArgs = {
  classId: Id<"classes">;
  items: TaskReorderItem[];
};

export function useReorderTasks() {
  const { t } = useTranslation("tasks");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.tasks.reorder);

  return useOptimisticMutation({
    mutationFn: (args: ReorderTasksArgs) =>
      mutationFn({ classId: args.classId, items: args.items }),
    queryKeys: (args) => [tasksListQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const key = tasksListQueryKey(args.classId);
      queryClient.setQueryData<TaskList>(key, (old) => {
        if (!old) return old;
        return applyTaskTopLevelOrder(old, args.items);
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("reorderFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
