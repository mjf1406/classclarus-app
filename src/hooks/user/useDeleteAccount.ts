import { useConvexMutation } from "@convex-dev/react-query";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { removeAllFileBytesQueries } from "@/hooks/files/useFileBytes";
import { accountDeletionBlockersQueryKey } from "@/hooks/user/useAccountDeletionBlockers";
import { currentUserQueryKey } from "@/hooks/user/useCurrentUser";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { codeFromError, messageFromError } from "@/lib/errors/convexError";

type CurrentUser = Doc<"users"> & {
  settings: Doc<"userSettings"> | null;
  providers: Array<string>;
};

const ACCOUNT_ERROR_KEYS = {
  OWNS_CLASSES: "errorOwnsClasses",
  ACTIVE_SUBSCRIPTION: "errorActiveSubscription",
  CONFIRMATION_MISMATCH: "errorConfirmationMismatch",
} as const;

export function useDeleteAccount() {
  const { t } = useTranslation("account");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.account.deleteAccount);
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userKey = currentUserQueryKey();
  const blockersKey = accountDeletionBlockersQueryKey();

  return useOptimisticMutation({
    mutationFn: (args: { confirmation: string }) => mutationFn(args),
    queryKeys: [userKey, blockersKey],
    applyOptimisticUpdate: (qc) => {
      qc.setQueryData<CurrentUser | null>(userKey, null);
    },
    onError: (error) => {
      const code = codeFromError(error);
      const title =
        code && code in ACCOUNT_ERROR_KEYS
          ? t(ACCOUNT_ERROR_KEYS[code as keyof typeof ACCOUNT_ERROR_KEYS])
          : messageFromError(error, t("deleteFailed"), tCommon("rateLimited"));

      toast.add({
        title,
        type: "error",
      });
    },
    onSuccess: async () => {
      removeAllFileBytesQueries(queryClient);
      await signOut();
      await navigate({ to: "/login" });
    },
  });
}
