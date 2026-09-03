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
  attachmentFileIds?: Array<Id<"files">>;
  procedureSteps?: Array<{ key: string; body: string }>;
  resources?: Array<{ key: string; url: string; label?: string }>;
  acceptLinkSubmissions?: boolean;
  hiddenFromStudents?: boolean;
  scheduledReleaseAt?: number;
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
      const attachmentFileIds = args.attachmentFileIds ?? [];
      queryClient.setQueryData<TaskList>(queryKey, (old) => {
        const studentCount = old?.[0]?.studentCount ?? 0;
        const next: TaskList[number] = {
          _id: optimisticId,
          _creationTime: now,
          classId: args.classId,
          name: args.name,
          description: args.description,
          dueDateKey: args.dueDateKey,
          attachmentFileIds,
          attachments: attachmentFileIds.map((fileId) => ({
            fileId,
            name: "",
            contentType: "application/octet-stream",
            size: 0,
            preset: "documents",
          })),
          createdBy: `optimistic:${randomClientId()}` as Id<"users">,
          createdAt: now,
          updatedAt: now,
          procedureSteps: args.procedureSteps ?? [],
          resources: args.resources ?? [],
          acceptLinkSubmissions: args.acceptLinkSubmissions === true,
          hiddenFromStudents: args.hiddenFromStudents === true,
          ...(args.scheduledReleaseAt !== undefined
            ? { scheduledReleaseAt: args.scheduledReleaseAt }
            : {}),
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
