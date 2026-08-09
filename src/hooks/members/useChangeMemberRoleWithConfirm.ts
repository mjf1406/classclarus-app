import { convexQuery } from "@convex-dev/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { useSetMemberRole } from "@/hooks/members/useSetMemberRole";
import { messageFromError } from "@/lib/errors/convexError";
import type { ClassMemberPublic, JoinCodeRole } from "@/lib/members/members";
import { getDisplayName } from "@/lib/user/userDisplay";

type PendingRoleChange = {
  member: ClassMemberPublic;
  role: JoinCodeRole;
};

export function useChangeMemberRoleWithConfirm(classId: Id<"classes">) {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const queryClient = useQueryClient();
  const setRoleMutation = useSetMemberRole();
  const [pending, setPending] = useState<PendingRoleChange | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const applyRoleChange = useCallback(
    async (member: ClassMemberPublic, role: JoinCodeRole) => {
      await setRoleMutation.mutateAsync({
        classId,
        userId: member.userId,
        role,
        fromRole: member.role,
      });
    },
    [classId, setRoleMutation],
  );

  const requestRoleChange = useCallback(
    async (member: ClassMemberPublic, role: JoinCodeRole) => {
      try {
        const result = await queryClient.fetchQuery({
          ...convexQuery(api.classPermissions.hasPermissionOverrides, {
            classId,
            userId: member.userId,
          }),
        });
        if (result.hasOverrides) {
          setPending({ member, role });
          setConfirmOpen(true);
          return;
        }
        await applyRoleChange(member, role);
      } catch (error) {
        toast.add({
          title: messageFromError(error, t("changeRoleFailed"), tCommon("rateLimited")),
          type: "error",
        });
      }
    },
    [applyRoleChange, classId, queryClient, t, tCommon],
  );

  const confirmPendingRoleChange = useCallback(() => {
    if (!pending) return;
    const { member, role } = pending;
    setConfirmOpen(false);
    setPending(null);
    void applyRoleChange(member, role);
  }, [applyRoleChange, pending]);

  const handleConfirmOpenChange = useCallback((open: boolean) => {
    setConfirmOpen(open);
    if (!open) {
      setPending(null);
    }
  }, []);

  const pendingMemberName = pending
    ? getDisplayName(
        {
          _id: pending.member.userId,
          name: pending.member.name,
          email: pending.member.email,
        },
        t("unnamedMember"),
      )
    : "";

  return {
    requestRoleChange,
    confirmPendingRoleChange,
    confirmOpen,
    handleConfirmOpenChange,
    pendingMemberName,
  };
}
