import { useAction } from "convex/react";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import { toast } from "@/components/ui/toast-manager";
import { messageFromError } from "@/lib/errors/convexError";

export function useSignOutOtherSessions() {
  const { t } = useTranslation("account");
  const { t: tCommon } = useTranslation("common");
  const signOutOther = useAction(api.account.signOutOtherSessions);

  return {
    mutateAsync: async () => {
      try {
        await signOutOther({});
        toast.add({
          title: t("signOutOtherSuccess"),
          type: "success",
        });
      } catch (error) {
        toast.add({
          title: messageFromError(error, t("signOutOtherFailed"), tCommon("rateLimited")),
          type: "error",
        });
        throw error;
      }
    },
  };
}
