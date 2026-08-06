import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import { toast } from "@/components/ui/toast-manager";
import { usageStatsQueryKey, type UsageStatsSummary } from "@/hooks/billing/useUsageStats";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { bumpSelfHostClick } from "@/lib/billing/usageStatsOptimistic";
import { messageFromError } from "@/lib/errors/convexError";

export function useTrackSelfHostClick() {
  const { t } = useTranslation("billing");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.usage.trackSelfHostClick);
  const statsKey = usageStatsQueryKey();

  return useOptimisticMutation({
    mutationFn: (_args: Record<string, never>) => mutationFn({}),
    queryKeys: [statsKey],
    applyOptimisticUpdate: (queryClient) => {
      queryClient.setQueryData<UsageStatsSummary>(statsKey, (old) =>
        old ? bumpSelfHostClick(old) : old,
      );
    },
    onError: (error) => {
      toast.add({
        type: "error",
        title: messageFromError(error, t("usageTrackFailed"), tCommon("rateLimited")),
      });
    },
  });
}
