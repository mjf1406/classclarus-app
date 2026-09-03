import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { taskDetailQueryKey } from "@/hooks/tasks/useTask";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";
import { isPersonalTaskDetail, type TaskDetail } from "@/lib/tasks/tasks";

type AddTaskLinkArgs = {
  classId: Id<"classes">;
  taskId: Id<"tasks">;
  url: string;
  label?: string;
  studentUserId: Id<"users">;
};

export function useAddTaskLink() {
  const { t } = useTranslation("tasks");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.tasks.addLink);

  return useOptimisticMutation({
    mutationFn: (args: AddTaskLinkArgs) =>
      mutationFn({ classId: args.classId, taskId: args.taskId, url: args.url, label: args.label }),
    queryKeys: (args) => [taskDetailQueryKey(args.classId, args.taskId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const now = Date.now();
      const nextLink = {
        _id: `optimistic:${randomClientId()}` as Id<"taskStudentLinks">,
        _creationTime: now,
        classId: args.classId,
        taskId: args.taskId,
        studentUserId: args.studentUserId,
        url: args.url,
        label: args.label,
        handedIn: false,
        createdAt: now,
        updatedAt: now,
      };
      queryClient.setQueryData<TaskDetail | null>(
        taskDetailQueryKey(args.classId, args.taskId),
        (old) => {
          if (!old) return old;
          if (isPersonalTaskDetail(old)) {
            return {
              ...old,
              students: old.students.map((student) =>
                student.userId === args.studentUserId
                  ? { ...student, links: [...student.links, nextLink] }
                  : student,
              ),
            };
          }
          return { ...old, links: [...old.links, nextLink] };
        },
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("linkSaveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}

type RemoveTaskLinkArgs = {
  classId: Id<"classes">;
  taskId: Id<"tasks">;
  linkId: Id<"taskStudentLinks">;
};

export function useRemoveTaskLink() {
  const { t } = useTranslation("tasks");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.tasks.removeLink);

  return useOptimisticMutation({
    mutationFn: (args: RemoveTaskLinkArgs) =>
      mutationFn({ classId: args.classId, linkId: args.linkId }),
    queryKeys: (args) => [taskDetailQueryKey(args.classId, args.taskId)],
    applyOptimisticUpdate: (queryClient, args) => {
      queryClient.setQueryData<TaskDetail | null>(
        taskDetailQueryKey(args.classId, args.taskId),
        (old) => {
          if (!old) return old;
          if (isPersonalTaskDetail(old)) {
            return {
              ...old,
              students: old.students.map((student) => ({
                ...student,
                links: student.links.filter((link) => link._id !== args.linkId),
              })),
            };
          }
          return { ...old, links: old.links.filter((link) => link._id !== args.linkId) };
        },
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("linkDeleteFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}

type SetTaskLinkHandedInArgs = {
  classId: Id<"classes">;
  taskId: Id<"tasks">;
  linkId: Id<"taskStudentLinks">;
  handedIn: boolean;
};

export function useSetTaskLinkHandedIn() {
  const { t } = useTranslation("tasks");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.tasks.setLinkHandedIn);

  return useOptimisticMutation({
    mutationFn: (args: SetTaskLinkHandedInArgs) =>
      mutationFn({ classId: args.classId, linkId: args.linkId, handedIn: args.handedIn }),
    queryKeys: (args) => [taskDetailQueryKey(args.classId, args.taskId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const now = Date.now();
      queryClient.setQueryData<TaskDetail | null>(
        taskDetailQueryKey(args.classId, args.taskId),
        (old) => {
          if (!old) return old;
          const patch = <
            T extends { _id: Id<"taskStudentLinks">; handedIn: boolean; updatedAt: number },
          >(
            link: T,
          ): T =>
            link._id === args.linkId ? { ...link, handedIn: args.handedIn, updatedAt: now } : link;
          if (isPersonalTaskDetail(old)) {
            return {
              ...old,
              students: old.students.map((student) => ({
                ...student,
                links: student.links.map(patch),
              })),
            };
          }
          return { ...old, links: old.links.map(patch) };
        },
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("linkHandInFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
