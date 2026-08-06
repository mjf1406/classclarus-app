import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { classMembersByRoleQueryKey } from "@/hooks/members/useClassMembersByRole";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { ClassMemberPublic, LinkedStudentPublic } from "@/lib/members/members";
import { messageFromError } from "@/lib/errors/convexError";

type SetGuardianStudentLinksArgs = {
  classId: Id<"classes">;
  guardianUserId: Id<"users">;
  studentUserIds: Id<"users">[];
  /** Resolved student display rows for optimistic cache update. */
  linkedStudents: LinkedStudentPublic[];
};

export function useSetGuardianStudentLinks() {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.members.setGuardianStudentLinks);

  return useOptimisticMutation({
    mutationFn: (args: SetGuardianStudentLinksArgs) =>
      mutationFn({
        classId: args.classId,
        guardianUserId: args.guardianUserId,
        studentUserIds: args.studentUserIds,
      }),
    queryKeys: (args) => [classMembersByRoleQueryKey(args.classId, "guardian")],
    applyOptimisticUpdate: (queryClient, args) => {
      const key = classMembersByRoleQueryKey(args.classId, "guardian");
      queryClient.setQueryData<ClassMemberPublic[]>(key, (old) => {
        if (!old) return old;
        return old.map((member) =>
          member.userId === args.guardianUserId
            ? { ...member, linkedStudents: args.linkedStudents }
            : member,
        );
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("linkStudentsFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
