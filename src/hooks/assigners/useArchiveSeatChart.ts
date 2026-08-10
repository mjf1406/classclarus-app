import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { seatChartQueryKey } from "@/hooks/assigners/useSeatChart";
import { seatChartsListQueryKey } from "@/hooks/assigners/useSeatCharts";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { SeatChart, SeatChartList } from "@/lib/assigners/seatCharts";
import { messageFromError } from "@/lib/errors/convexError";

type ArchiveSeatChartArgs = {
  classId: Id<"classes">;
  chartId: Id<"seatCharts">;
};

export function useArchiveSeatChart() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.seatCharts.archive);

  return useOptimisticMutation({
    mutationFn: (args: ArchiveSeatChartArgs) => mutationFn(args),
    queryKeys: (args) => [
      seatChartsListQueryKey(args.classId),
      seatChartsListQueryKey(args.classId, true),
      seatChartQueryKey(args.classId, args.chartId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const now = Date.now();
      queryClient.setQueryData<SeatChartList>(seatChartsListQueryKey(args.classId), (old) =>
        old?.filter((chart) => chart._id !== args.chartId),
      );
      queryClient.setQueryData<SeatChartList>(seatChartsListQueryKey(args.classId, true), (old) =>
        old?.map((chart) =>
          chart._id === args.chartId ? { ...chart, archivedAt: now, updatedAt: now } : chart,
        ),
      );
      queryClient.setQueryData<SeatChart>(seatChartQueryKey(args.classId, args.chartId), (old) =>
        old ? { ...old, archivedAt: now, updatedAt: now } : old,
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("chartSaveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
