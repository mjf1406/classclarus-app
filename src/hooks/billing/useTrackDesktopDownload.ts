import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { DesktopOs } from "../../../convex/lib/usageTracking";
import { toast } from "@/components/ui/toast-manager";
import { usageStatsQueryKey, type UsageStatsSummary } from "@/hooks/billing/useUsageStats";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { bumpDesktopDownload } from "@/lib/billing/usageStatsOptimistic";
import { messageFromError } from "@/lib/errors/convexError";

export function useTrackDesktopDownload() {
  const { t } = useTranslation("billing");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.usage.trackDesktopDownload);
  const statsKey = usageStatsQueryKey();

  return useOptimisticMutation({
    mutationFn: (args: { os: DesktopOs }) => mutationFn(args),
    queryKeys: [statsKey],
    applyOptimisticUpdate: (queryClient, args) => {
      queryClient.setQueryData<UsageStatsSummary>(statsKey, (old) =>
        old ? bumpDesktopDownload(old, args.os) : old,
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
