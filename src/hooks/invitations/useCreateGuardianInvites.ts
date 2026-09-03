import { useConvexMutation } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { joinCodesListQueryKey } from "@/hooks/invitations/useJoinCodes";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";

type CreateGuardianInvitesArgs = {
  classId: Id<"classes">;
  studentUserIds: Array<Id<"users">>;
  ttlMs: number;
  maxUses: number;
};

/** Generate per-student guardian codes. Cache is invalidated; no optimistic insert. */
export function useCreateGuardianInvites() {
  const mutationFn = useConvexMutation(api.joinCodes.createGuardianInvites);

  return useOptimisticMutation({
    mutationFn: (args: CreateGuardianInvitesArgs) => mutationFn(args),
    queryKeys: (args) => [joinCodesListQueryKey(args.classId)],
  });
}
