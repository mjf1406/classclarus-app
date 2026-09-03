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

type SetTaskReleasedArgs = {
  classId: Id<"classes">;
  taskId: Id<"tasks">;
  released: boolean;
  scheduledReleaseAt?: number;
};

export function useSetTaskReleased() {
  const { t } = useTranslation("tasks");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.tasks.setReleased);

  return useOptimisticMutation({
    mutationFn: (args: SetTaskReleasedArgs) => mutationFn(args),
    queryKeys: (args) => [
      tasksListQueryKey(args.classId),
      taskDetailQueryKey(args.classId, args.taskId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const now = Date.now();
      const hiddenFromStudents = !args.released || args.scheduledReleaseAt !== undefined;
      const patch = {
        hiddenFromStudents,
        scheduledReleaseAt: args.released ? undefined : args.scheduledReleaseAt,
        updatedAt: now,
      };
      queryClient.setQueryData<TaskList>(tasksListQueryKey(args.classId), (old) => {
        if (!old) return old;
        return old.map((item) => (item._id === args.taskId ? { ...item, ...patch } : item));
      });
      queryClient.setQueryData<TaskDetail | null>(
        taskDetailQueryKey(args.classId, args.taskId),
        (old) => (old ? { ...old, ...patch } : old),
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("releaseFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
