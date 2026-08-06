import { useMutation } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import { toast } from "@/components/ui/toast-manager";
import { billingMessageFromError } from "@/lib/billing/errors";

export function useCreateCheckoutLink() {
  const { t } = useTranslation("billing");
  const { t: tCommon } = useTranslation("common");
  const generateCheckoutLink = useAction(api.billingActions.createCheckoutLink);

  return useMutation({
    mutationFn: (args: { productId: string }) => generateCheckoutLink(args),
    onError: (error: unknown) => {
      toast.add({
        type: "error",
        title: billingMessageFromError(error, t, t("checkoutFailed"), tCommon("rateLimited")),
      });
    },
  });
}
