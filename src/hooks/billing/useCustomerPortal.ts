import { useMutation } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import { toast } from "@/components/ui/toast-manager";
import { billingMessageFromError } from "@/lib/billing/errors";
import { assertSafePolarCheckoutUrl } from "@/lib/billing/polarUrl";

export function useCustomerPortal() {
  const { t } = useTranslation("billing");
  const { t: tCommon } = useTranslation("common");
  const generateUrl = useAction(api.billingActions.generateCustomerPortalUrl);

  return useMutation({
    mutationFn: async () => {
      const { url } = await generateUrl({});
      const safeUrl = assertSafePolarCheckoutUrl(url);
      window.open(safeUrl, "_blank", "noopener,noreferrer");
      return safeUrl;
    },
    onError: (error: unknown) => {
      toast.add({
        type: "error",
        title: billingMessageFromError(error, t, t("portalFailed"), tCommon("rateLimited")),
      });
    },
  });
}
