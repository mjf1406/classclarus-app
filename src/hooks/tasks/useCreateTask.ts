import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { tasksListQueryKey } from "@/hooks/tasks/useTasks";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";
import type { TaskList } from "@/lib/tasks/tasks";

type CreateTaskArgs = {
  classId: Id<"classes">;
  name: string;
  description?: string;
  dueDateKey?: string;
  worksheetImageFileId?: Id<"files">;
};

export function useCreateTask() {
  const { t } = useTranslation("tasks");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.tasks.create);

  return useOptimisticMutation({
    mutationFn: (args: CreateTaskArgs) => mutationFn(args),
    queryKeys: (args) => [tasksListQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = tasksListQueryKey(args.classId);
      const now = Date.now();
      const optimisticId = `optimistic:${randomClientId()}` as Id<"tasks">;
      queryClient.setQueryData<TaskList>(queryKey, (old) => {
        const studentCount = old?.[0]?.studentCount ?? 0;
        const next: TaskList[number] = {
          _id: optimisticId,
          _creationTime: now,
          classId: args.classId,
          name: args.name,
          description: args.description,
          dueDateKey: args.dueDateKey,
          ...(args.worksheetImageFileId !== undefined
            ? { worksheetImageFileId: args.worksheetImageFileId }
            : {}),
          createdBy: `optimistic:${randomClientId()}` as Id<"users">,
          createdAt: now,
          updatedAt: now,
          completedCount: 0,
          studentCount,
          completedStudentIds: [],
        };
        if (!old) return [next];
        return [next, ...old];
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
