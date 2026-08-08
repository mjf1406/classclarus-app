import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { assignmentDetailQueryKey } from "@/hooks/assignments/useAssignment";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { isPersonalAssignmentDetail, type AssignmentDetail } from "@/lib/assignments/assignments";
import { messageFromError } from "@/lib/errors/convexError";

type UpdateAssignmentLinkArgs = {
  classId: Id<"classes">;
  assignmentId: Id<"assignments">;
  linkId: Id<"assignmentStudentLinks">;
  url: string;
  label?: string;
};

export function useUpdateAssignmentLink() {
  const { t } = useTranslation("assignments");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.assignments.updateLink);

  return useOptimisticMutation({
    mutationFn: (args: UpdateAssignmentLinkArgs) =>
      mutationFn({
        classId: args.classId,
        linkId: args.linkId,
        url: args.url,
        label: args.label,
      }),
    queryKeys: (args) => [assignmentDetailQueryKey(args.classId, args.assignmentId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const now = Date.now();
      queryClient.setQueryData<AssignmentDetail | null>(
        assignmentDetailQueryKey(args.classId, args.assignmentId),
        (old) => {
          if (!old) return old;
          const patchLink = <T extends { _id: Id<"assignmentStudentLinks"> }>(link: T): T =>
            link._id === args.linkId
              ? { ...link, url: args.url, label: args.label, updatedAt: now }
              : link;

          if (isPersonalAssignmentDetail(old)) {
            return {
              ...old,
              students: old.students.map((student) => ({
                ...student,
                links: student.links.map(patchLink),
              })),
            };
          }
          return { ...old, links: old.links.map(patchLink) };
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
