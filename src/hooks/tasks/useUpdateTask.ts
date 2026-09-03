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
  attachmentFileIds?: Array<Id<"files">>;
  procedureSteps?: Array<{ key: string; body: string }>;
  resources?: Array<{ key: string; url: string; label?: string }>;
  acceptLinkSubmissions?: boolean;
  hiddenFromStudents?: boolean;
  scheduledReleaseAt?: number;
};

function optimisticAttachments(
  fileIds: Array<Id<"files">>,
  existing: Array<{
    fileId: Id<"files">;
    name: string;
    contentType: string;
    size: number;
    preset: string;
  }>,
) {
  return fileIds.map((fileId) => {
    const found = existing.find((item) => item.fileId === fileId);
    return (
      found ?? {
        fileId,
        name: "",
        contentType: "application/octet-stream",
        size: 0,
        preset: "documents",
      }
    );
  });
}

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
        return old.map((item) => {
          if (item._id !== args.taskId) return item;
          const attachmentFileIds = args.attachmentFileIds ?? item.attachmentFileIds;
          return {
            ...item,
            name: args.name,
            description: args.description,
            dueDateKey: args.dueDateKey,
            attachmentFileIds,
            attachments: optimisticAttachments(attachmentFileIds, item.attachments),
            procedureSteps: args.procedureSteps ?? item.procedureSteps,
            resources: args.resources ?? item.resources,
            acceptLinkSubmissions: args.acceptLinkSubmissions ?? item.acceptLinkSubmissions,
            hiddenFromStudents: args.hiddenFromStudents ?? item.hiddenFromStudents,
            scheduledReleaseAt: args.scheduledReleaseAt,
            updatedAt: now,
          };
        });
      });

      queryClient.setQueryData<TaskDetail | null>(detailKey, (old) => {
        if (!old) return old;
        const attachmentFileIds = args.attachmentFileIds ?? old.attachmentFileIds;
        return {
          ...old,
          name: args.name,
          description: args.description,
          dueDateKey: args.dueDateKey,
          attachmentFileIds,
          attachments: optimisticAttachments(attachmentFileIds, old.attachments),
          procedureSteps: args.procedureSteps ?? old.procedureSteps,
          resources: args.resources ?? old.resources,
          acceptLinkSubmissions: args.acceptLinkSubmissions ?? old.acceptLinkSubmissions,
          hiddenFromStudents: args.hiddenFromStudents ?? old.hiddenFromStudents,
          scheduledReleaseAt: args.scheduledReleaseAt,
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
