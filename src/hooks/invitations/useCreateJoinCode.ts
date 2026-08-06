import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { joinCodesListQueryKey } from "@/hooks/invitations/useJoinCodes";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { createOptimisticJoinCodeId, type JoinCodePublic } from "@/lib/invitations/joinCodes";
import type { JoinCodeRole } from "@/lib/permissions/classPermissions";
import { messageFromError } from "@/lib/errors/convexError";

type CreateJoinCodeArgs = {
  classId: Id<"classes">;
  role: JoinCodeRole;
  ttlMs: number;
  maxUses: number;
};

/**
 * Optimistic create for join codes.
 * `listNow` should match the `now` used by the active list query so the cache key aligns.
 */
export function useCreateJoinCode(listNow: number) {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.joinCodes.create);

  return useOptimisticMutation({
    mutationFn: (args: CreateJoinCodeArgs) => mutationFn(args),
    queryKeys: (args) => [joinCodesListQueryKey(args.classId, listNow)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = joinCodesListQueryKey(args.classId, listNow);
      const now = Date.now();
      const optimistic: JoinCodePublic = {
        _id: createOptimisticJoinCodeId(),
        _creationTime: now,
        code: "······",
        classId: args.classId,
        createdBy: "optimistic" as Id<"users">,
        role: args.role,
        expiresAt: now + args.ttlMs,
        maxUses: args.maxUses,
        useCount: 0,
        _pending: true,
      };
      queryClient.setQueryData<JoinCodePublic[]>(queryKey, (old) =>
        old ? [optimistic, ...old] : [optimistic],
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("createInviteFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
