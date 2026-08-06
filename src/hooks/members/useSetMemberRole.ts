import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { classesListQueryKey } from "@/hooks/classes/useClasses";
import { classMemberCountsQueryKey } from "@/hooks/members/useClassMemberCounts";
import { classMembersByRoleQueryKey } from "@/hooks/members/useClassMembersByRole";
import { classPermissionsQueryKey } from "@/hooks/permissions/useClassPermissions";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import {
  memberListRoleFor,
  type ClassMemberCounts,
  type ClassMemberPublic,
  type JoinCodeRole,
  type MemberListRole,
} from "@/lib/members/members";
import { messageFromError } from "@/lib/errors/convexError";
import { JOIN_CODE_ROLES } from "@/lib/permissions/classPermissions";

type SetMemberRoleArgs = {
  classId: Id<"classes">;
  userId: Id<"users">;
  role: JoinCodeRole;
  /** Current membership role (for optimistic list moves). */
  fromRole: ClassMemberPublic["role"];
};

function sortMembers(members: ClassMemberPublic[]): ClassMemberPublic[] {
  return [...members].sort((a, b) => {
    const roleRank = (role: ClassMemberPublic["role"]) => (role === "owner" ? 0 : 1);
    const byRole = roleRank(a.role) - roleRank(b.role);
    if (byRole !== 0) return byRole;
    const nameA = (a.name ?? a.email ?? a.userId).toLocaleLowerCase();
    const nameB = (b.name ?? b.email ?? b.userId).toLocaleLowerCase();
    return nameA.localeCompare(nameB);
  });
}

function adjustCount(
  counts: ClassMemberCounts,
  listRole: MemberListRole,
  delta: number,
): ClassMemberCounts {
  const current = counts[listRole];
  if (current === null) return counts;
  return { ...counts, [listRole]: Math.max(0, current + delta) };
}

export function useSetMemberRole() {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.members.setRole);

  return useOptimisticMutation({
    mutationFn: (args: SetMemberRoleArgs) =>
      mutationFn({
        classId: args.classId,
        userId: args.userId,
        role: args.role,
      }),
    queryKeys: (args) => {
      const fromList = memberListRoleFor(args.fromRole);
      const toList = memberListRoleFor(args.role);
      const listKeys =
        fromList === toList
          ? [classMembersByRoleQueryKey(args.classId, fromList)]
          : [
              classMembersByRoleQueryKey(args.classId, fromList),
              classMembersByRoleQueryKey(args.classId, toList),
            ];
      return [...listKeys, classMemberCountsQueryKey(args.classId)];
    },
    invalidateQueryKeys: (args) => [
      ...JOIN_CODE_ROLES.map((listRole) => classMembersByRoleQueryKey(args.classId, listRole)),
      classMemberCountsQueryKey(args.classId),
      classesListQueryKey(),
      classPermissionsQueryKey(args.classId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const fromList = memberListRoleFor(args.fromRole);
      const toList = memberListRoleFor(args.role);
      const fromKey = classMembersByRoleQueryKey(args.classId, fromList);
      const toKey = classMembersByRoleQueryKey(args.classId, toList);
      const countsKey = classMemberCountsQueryKey(args.classId);
      const guardiansKey = classMembersByRoleQueryKey(args.classId, "guardian");

      // Student leaving student role → strip from every guardian's linkedStudents.
      if (args.fromRole === "student") {
        queryClient.setQueryData<ClassMemberPublic[]>(guardiansKey, (old) => {
          if (!old) return old;
          return old.map((member) => ({
            ...member,
            linkedStudents: member.linkedStudents?.filter(
              (student) => student.userId !== args.userId,
            ),
          }));
        });
      }

      const fromMembers = queryClient.getQueryData<ClassMemberPublic[]>(fromKey);
      const moving = fromMembers?.find((member) => member.userId === args.userId);
      const updatedMember: ClassMemberPublic | undefined = moving
        ? {
            ...moving,
            role: args.role,
            linkedStudents: args.role === "guardian" ? [] : undefined,
          }
        : undefined;

      if (fromList === toList) {
        queryClient.setQueryData<ClassMemberPublic[]>(fromKey, (old) => {
          if (!old) return old;
          return sortMembers(
            old.map((member) =>
              member.userId === args.userId ? { ...member, role: args.role } : member,
            ),
          );
        });
        return;
      }

      queryClient.setQueryData<ClassMemberPublic[]>(fromKey, (old) => {
        if (!old) return old;
        return old.filter((member) => member.userId !== args.userId);
      });

      if (updatedMember) {
        queryClient.setQueryData<ClassMemberPublic[]>(toKey, (old) => {
          if (!old) return old;
          if (old.some((member) => member.userId === args.userId)) {
            return sortMembers(
              old.map((member) =>
                member.userId === args.userId ? { ...member, role: args.role } : member,
              ),
            );
          }
          return sortMembers([...old, updatedMember]);
        });
      }

      queryClient.setQueryData<ClassMemberCounts>(countsKey, (old) => {
        if (!old) return old;
        return adjustCount(adjustCount(old, fromList, -1), toList, 1);
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("changeRoleFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
