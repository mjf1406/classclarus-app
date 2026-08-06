import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { fileBytesQueryKey } from "@/hooks/files/useFileBytes";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { currentUserQueryKey } from "@/hooks/user/useCurrentUser";
import { messageFromError } from "@/lib/errors/convexError";

type CurrentUser = Doc<"users"> & {
  settings: Doc<"userSettings"> | null;
  providers: Array<string>;
};

/**
 * Optimistic profile photo removal (self-host / Electron).
 * Shares `currentUserQueryKey` with `useCurrentUser` (gcTime: 1 hour).
 */
export function useClearAvatar() {
  const { t } = useTranslation("account");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.users.clearAvatar);
  const queryKey = currentUserQueryKey();

  return useOptimisticMutation({
    mutationFn: (_args: Record<string, never>) => mutationFn({}),
    queryKeys: [queryKey],
    applyOptimisticUpdate: (queryClient) => {
      const previous = queryClient.getQueryData<CurrentUser | null>(queryKey);
      const previousAvatarId = previous?.avatarFileId;
      if (previousAvatarId !== undefined) {
        void queryClient.removeQueries({ queryKey: fileBytesQueryKey(previousAvatarId) });
      }
      queryClient.setQueryData<CurrentUser | null>(queryKey, (old) => {
        if (!old) return old;
        return { ...old, avatarFileId: undefined, image: undefined };
      });
    },
    onError: (error) => {
      toast.add({
        type: "error",
        title: messageFromError(error, t("avatarClearFailed"), tCommon("rateLimited")),
      });
    },
  });
}
