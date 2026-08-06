import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { joinCodesListQueryKey } from "@/hooks/invitations/useJoinCodes";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { JoinCodePublic } from "@/lib/invitations/joinCodes";
import { messageFromError } from "@/lib/errors/convexError";
import { removeById } from "@/lib/optimistic";

type RevokeJoinCodeArgs = {
  classId: Id<"classes">;
  joinCodeId: Id<"joinCodes">;
};

export function useRevokeJoinCode(listNow: number) {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.joinCodes.revoke);

  return useOptimisticMutation({
    mutationFn: (args: RevokeJoinCodeArgs) => mutationFn(args),
    queryKeys: (args) => [joinCodesListQueryKey(args.classId, listNow)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = joinCodesListQueryKey(args.classId, listNow);
      queryClient.setQueryData<JoinCodePublic[]>(queryKey, (old) =>
        old ? removeById(old, args.joinCodeId) : old,
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("revokeInviteFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
