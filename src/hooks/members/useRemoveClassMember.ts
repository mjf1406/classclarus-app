import { useConvexMutation } from "@convex-dev/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { classesListQueryKey } from "@/hooks/classes/useClasses";
import { groupsBoardQueryKey } from "@/hooks/groups/useGroupsBoard";
import { classMemberCountsQueryKey } from "@/hooks/members/useClassMemberCounts";
import { classMembersByRoleQueryKey } from "@/hooks/members/useClassMembersByRole";
import { classPermissionsQueryKey } from "@/hooks/permissions/useClassPermissions";
import { studentRosterQueryKey } from "@/hooks/roster/useStudentRoster";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { ClassMemberCounts, ClassMemberPublic, MemberListRole } from "@/lib/members/members";
import type { StudentRosterEntry } from "@/lib/roster/roster";
import { messageFromError } from "@/lib/errors/convexError";

type RemoveClassMemberArgs = {
  classId: Id<"classes">;
  userId: Id<"users">;
};

export function useRemoveClassMember(listRole: MemberListRole) {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.members.remove);

  return useOptimisticMutation({
    mutationFn: (args: RemoveClassMemberArgs) => mutationFn(args),
    queryKeys: (args) => {
      const keys: QueryKey[] = [
        classMembersByRoleQueryKey(args.classId, listRole),
        classMemberCountsQueryKey(args.classId),
      ];
      if (listRole === "student") {
        keys.push(classMembersByRoleQueryKey(args.classId, "guardian"));
        keys.push(studentRosterQueryKey(args.classId));
      }
      return keys;
    },
    invalidateQueryKeys: (args) => {
      const keys: QueryKey[] = [classesListQueryKey(), classPermissionsQueryKey(args.classId)];
      if (listRole === "student") {
        keys.push(classMembersByRoleQueryKey(args.classId, "guardian"));
        keys.push(groupsBoardQueryKey(args.classId));
        keys.push(studentRosterQueryKey(args.classId));
      }
      return keys;
    },
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = classMembersByRoleQueryKey(args.classId, listRole);
      const countsKey = classMemberCountsQueryKey(args.classId);
      queryClient.setQueryData<ClassMemberPublic[]>(queryKey, (old) => {
        if (!old) return old;
        return old.filter((member) => member.userId !== args.userId);
      });
      queryClient.setQueryData<ClassMemberCounts>(countsKey, (old) => {
        if (!old) return old;
        const current = old[listRole];
        if (current === null) return old;
        return { ...old, [listRole]: Math.max(0, current - 1) };
      });
      if (listRole === "student") {
        const guardiansKey = classMembersByRoleQueryKey(args.classId, "guardian");
        queryClient.setQueryData<ClassMemberPublic[]>(guardiansKey, (old) => {
          if (!old) return old;
          return old.map((member) => ({
            ...member,
            linkedStudents: member.linkedStudents?.filter(
              (student) => student.userId !== args.userId,
            ),
          }));
        });
        const rosterKey = studentRosterQueryKey(args.classId);
        queryClient.setQueryData<StudentRosterEntry[]>(rosterKey, (old) => {
          if (!old) return old;
          return old
            .filter((entry) => entry.userId !== args.userId)
            .map((entry, index) => ({ ...entry, rosterNumber: index + 1 }));
        });
      }
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("removeMemberFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
