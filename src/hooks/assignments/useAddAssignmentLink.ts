import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { assignmentDetailQueryKey } from "@/hooks/assignments/useAssignment";
import { assignmentsListQueryKey } from "@/hooks/assignments/useAssignments";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import {
  isPersonalAssignmentDetail,
  type AssignmentDetail,
  type AssignmentList,
} from "@/lib/assignments/assignments";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";

type AddAssignmentLinkArgs = {
  classId: Id<"classes">;
  assignmentId: Id<"assignments">;
  url: string;
  label?: string;
  studentUserId: Id<"users">;
};

export function useAddAssignmentLink() {
  const { t } = useTranslation("assignments");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.assignments.addLink);

  return useOptimisticMutation({
    mutationFn: (args: AddAssignmentLinkArgs) =>
      mutationFn({
        classId: args.classId,
        assignmentId: args.assignmentId,
        url: args.url,
        label: args.label,
      }),
    queryKeys: (args) => [
      assignmentsListQueryKey(args.classId),
      assignmentDetailQueryKey(args.classId, args.assignmentId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const now = Date.now();
      const optimisticId = `optimistic:${randomClientId()}` as Id<"assignmentStudentLinks">;
      const nextLink = {
        _id: optimisticId,
        _creationTime: now,
        classId: args.classId,
        assignmentId: args.assignmentId,
        studentUserId: args.studentUserId,
        url: args.url,
        label: args.label,
        handedIn: false,
        createdAt: now,
        updatedAt: now,
      };

      queryClient.setQueryData<AssignmentDetail | null>(
        assignmentDetailQueryKey(args.classId, args.assignmentId),
        (old) => {
          if (!old) return old;
          if (isPersonalAssignmentDetail(old)) {
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

      queryClient.setQueryData<AssignmentList>(assignmentsListQueryKey(args.classId), (old) => {
        if (!old) return old;
        return old.map((item) =>
          item._id === args.assignmentId ? { ...item, linkCount: item.linkCount + 1 } : item,
        );
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("linkSaveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
