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

type RemoveAssignmentLinkArgs = {
  classId: Id<"classes">;
  assignmentId: Id<"assignments">;
  linkId: Id<"assignmentStudentLinks">;
};

export function useRemoveAssignmentLink() {
  const { t } = useTranslation("assignments");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.assignments.removeLink);

  return useOptimisticMutation({
    mutationFn: (args: RemoveAssignmentLinkArgs) =>
      mutationFn({
        classId: args.classId,
        linkId: args.linkId,
      }),
    queryKeys: (args) => [
      assignmentsListQueryKey(args.classId),
      assignmentDetailQueryKey(args.classId, args.assignmentId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      queryClient.setQueryData<AssignmentDetail | null>(
        assignmentDetailQueryKey(args.classId, args.assignmentId),
        (old) => {
          if (!old) return old;
          if (isPersonalAssignmentDetail(old)) {
            return {
              ...old,
              students: old.students.map((student) => ({
                ...student,
                links: student.links.filter((link) => link._id !== args.linkId),
              })),
            };
          }
          return {
            ...old,
            links: old.links.filter((link) => link._id !== args.linkId),
          };
        },
      );

      queryClient.setQueryData<AssignmentList>(assignmentsListQueryKey(args.classId), (old) => {
        if (!old) return old;
        return old.map((item) =>
          item._id === args.assignmentId
            ? { ...item, linkCount: Math.max(0, item.linkCount - 1) }
            : item,
        );
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("linkDeleteFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
