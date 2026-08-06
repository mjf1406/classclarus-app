import { useMutation, useQueryClient } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useAction } from "convex/react";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import { toast } from "@/components/ui/toast-manager";
import { billingMessageFromError } from "@/lib/billing/errors";
import { billingHistoryQueryKey } from "@/hooks/billing/useBillingHistory";

export function useChangeSubscription() {
  const { t } = useTranslation("billing");
  const { t: tCommon } = useTranslation("common");
  const queryClient = useQueryClient();
  const change = useAction(api.billingActions.changeSubscription);

  return useMutation({
    mutationFn: (args: { productId: string }) => change(args),
    onError: (error: unknown) => {
      toast.add({
        type: "error",
        title: billingMessageFromError(error, t, t("changeFailed"), tCommon("rateLimited")),
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: convexQuery(api.billing.getEntitlement, {}).queryKey,
      });
      void queryClient.invalidateQueries({ queryKey: billingHistoryQueryKey });
    },
  });
}
