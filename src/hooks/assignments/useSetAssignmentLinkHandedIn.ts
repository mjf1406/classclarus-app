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

type SetAssignmentLinkHandedInArgs = {
  classId: Id<"classes">;
  assignmentId: Id<"assignments">;
  linkId: Id<"assignmentStudentLinks">;
  handedIn: boolean;
  studentUserId: Id<"users">;
};

export function useSetAssignmentLinkHandedIn() {
  const { t } = useTranslation("assignments");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.assignments.setLinkHandedIn);

  return useOptimisticMutation({
    mutationFn: (args: SetAssignmentLinkHandedInArgs) =>
      mutationFn({
        classId: args.classId,
        linkId: args.linkId,
        handedIn: args.handedIn,
      }),
    queryKeys: (args) => [
      assignmentsListQueryKey(args.classId),
      assignmentDetailQueryKey(args.classId, args.assignmentId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const now = Date.now();
      const detailKey = assignmentDetailQueryKey(args.classId, args.assignmentId);
      const previousDetail = queryClient.getQueryData<AssignmentDetail | null>(detailKey);

      queryClient.setQueryData<AssignmentDetail | null>(detailKey, (old) => {
        if (!old) return old;
        const patchLink = <T extends { _id: Id<"assignmentStudentLinks">; handedIn: boolean }>(
          link: T,
        ): T =>
          link._id === args.linkId ? { ...link, handedIn: args.handedIn, updatedAt: now } : link;

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
      });

      // Adjust handed-in student count when this toggle changes whether the student has any hand-in.
      if (previousDetail && !isPersonalAssignmentDetail(previousDetail)) {
        const studentLinks = previousDetail.links.filter(
          (link) => link.studentUserId === args.studentUserId,
        );
        const hadHandedIn = studentLinks.some((link) => link.handedIn);
        const willHaveHandedIn = studentLinks.some((link) =>
          link._id === args.linkId ? args.handedIn : link.handedIn,
        );
        if (hadHandedIn !== willHaveHandedIn) {
          const delta = willHaveHandedIn ? 1 : -1;
          queryClient.setQueryData<AssignmentList>(assignmentsListQueryKey(args.classId), (old) => {
            if (!old) return old;
            return old.map((item) =>
              item._id === args.assignmentId
                ? {
                    ...item,
                    handedInStudentCount: Math.max(
                      0,
                      Math.min(item.studentCount, item.handedInStudentCount + delta),
                    ),
                    handedInStudentIds: (() => {
                      const current = item.handedInStudentIds ?? [];
                      if (willHaveHandedIn) {
                        return current.includes(args.studentUserId)
                          ? current
                          : [...current, args.studentUserId];
                      }
                      return current.filter((id) => id !== args.studentUserId);
                    })(),
                  }
                : item,
            );
          });
        }
      }
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("linkHandInFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
