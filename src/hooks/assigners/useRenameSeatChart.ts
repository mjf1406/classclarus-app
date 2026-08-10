import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { seatChartQueryKey } from "@/hooks/assigners/useSeatChart";
import { seatChartsListQueryKey } from "@/hooks/assigners/useSeatCharts";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { SeatChart } from "@/lib/assigners/seatCharts";
import type { SeatChartList } from "@/lib/assigners/seatCharts";
import { messageFromError } from "@/lib/errors/convexError";

type RenameSeatChartArgs = {
  classId: Id<"classes">;
  chartId: Id<"seatCharts">;
  name: string;
};

export function useRenameSeatChart() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.seatCharts.rename);

  return useOptimisticMutation({
    mutationFn: (args: RenameSeatChartArgs) => mutationFn(args),
    queryKeys: (args) => [
      seatChartsListQueryKey(args.classId),
      seatChartsListQueryKey(args.classId, true),
      seatChartQueryKey(args.classId, args.chartId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const name = args.name.trim();
      const patchList = (includeArchived?: boolean) => {
        queryClient.setQueryData<SeatChartList>(
          seatChartsListQueryKey(args.classId, includeArchived),
          (old) => old?.map((chart) => (chart._id === args.chartId ? { ...chart, name } : chart)),
        );
      };
      patchList(false);
      patchList(true);
      queryClient.setQueryData<SeatChart>(seatChartQueryKey(args.classId, args.chartId), (old) =>
        old ? { ...old, name } : old,
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
