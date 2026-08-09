import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { hasPermissionOverridesQueryKey } from "@/hooks/permissions/useHasPermissionOverrides";
import { memberPermissionsQueryKey } from "@/hooks/permissions/useMemberPermissions";
import { classPermissionsQueryKey } from "@/hooks/permissions/useClassPermissions";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import { effectivePermissionEnabled } from "@/lib/permissions/classPermissions";

type MemberPermissionsData = {
  userId: Id<"users">;
  role: "teacher" | "assistant_teacher";
  permissions: Array<{
    permission: string;
    roleDefault: boolean;
    override: "allow" | "deny" | null;
    effective: boolean;
  }>;
};

type SetMemberPermissionArgs = {
  classId: Id<"classes">;
  userId: Id<"users">;
  permission: string;
  enabled: boolean;
};

export function useSetMemberPermission() {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.classPermissions.setMemberPermission);

  return useOptimisticMutation({
    mutationFn: (args: SetMemberPermissionArgs) =>
      mutationFn({
        classId: args.classId,
        userId: args.userId,
        permission: args.permission,
        enabled: args.enabled,
      }),
    queryKeys: (args) => [
      memberPermissionsQueryKey(args.classId, args.userId),
      hasPermissionOverridesQueryKey(args.classId, args.userId),
    ],
    invalidateQueryKeys: (args) => [
      memberPermissionsQueryKey(args.classId, args.userId),
      hasPermissionOverridesQueryKey(args.classId, args.userId),
      classPermissionsQueryKey(args.classId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const key = memberPermissionsQueryKey(args.classId, args.userId);
      queryClient.setQueryData<MemberPermissionsData>(key, (old) => {
        if (!old) return old;
        return {
          ...old,
          permissions: old.permissions.map((entry) => {
            if (entry.permission !== args.permission) return entry;
            let override: "allow" | "deny" | null = null;
            if (args.enabled && !entry.roleDefault) override = "allow";
            if (!args.enabled && entry.roleDefault) override = "deny";
            return {
              ...entry,
              override,
              effective: effectivePermissionEnabled(entry.roleDefault, override),
            };
          }),
        };
      });

      const hasKey = hasPermissionOverridesQueryKey(args.classId, args.userId);
      queryClient.setQueryData<{ hasOverrides: boolean }>(hasKey, (old) => {
        const detail = queryClient.getQueryData<MemberPermissionsData>(key);
        const hasOverrides = (detail?.permissions ?? []).some((entry) => entry.override !== null);
        return old ? { ...old, hasOverrides } : { hasOverrides };
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("permissionsUpdateFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
