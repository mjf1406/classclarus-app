import { useAction } from "convex/react";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { messageFromError } from "@/lib/errors/convexError";

export function useAdminResetPassword() {
  const { t } = useTranslation("admin");
  const { t: tCommon } = useTranslation("common");
  const resetPassword = useAction(api.adminUsers.resetPassword);

  return {
    mutateAsync: async (args: { userId: Id<"users">; newPassword: string }) => {
      try {
        await resetPassword(args);
        toast.add({
          title: t("resetSuccess"),
          type: "success",
        });
      } catch (error) {
        toast.add({
          title: messageFromError(error, t("resetFailed"), tCommon("rateLimited")),
          type: "error",
        });
        throw error;
      }
    },
  };
}
