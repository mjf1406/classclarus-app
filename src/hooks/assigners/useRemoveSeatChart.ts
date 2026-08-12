import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { seatChartQueryKey } from "@/hooks/assigners/useSeatChart";
import { seatChartsListQueryKey } from "@/hooks/assigners/useSeatCharts";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { SeatChartList } from "@/lib/assigners/seatCharts";
import { messageFromError } from "@/lib/errors/convexError";

type RemoveSeatChartArgs = {
  classId: Id<"classes">;
  chartId: Id<"seatCharts">;
};

export function useRemoveSeatChart() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.seatCharts.remove);

  return useOptimisticMutation({
    mutationFn: (args: RemoveSeatChartArgs) => mutationFn(args),
    queryKeys: (args) => [
      seatChartsListQueryKey(args.classId),
      seatChartQueryKey(args.classId, args.chartId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      queryClient.setQueryData<SeatChartList>(seatChartsListQueryKey(args.classId), (old) => {
        if (!old) return old;
        return old.filter((chart) => chart._id !== args.chartId);
      });
      queryClient.setQueryData(seatChartQueryKey(args.classId, args.chartId), null);
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("chartSaveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
