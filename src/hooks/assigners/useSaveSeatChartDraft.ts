import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { seatChartQueryKey } from "@/hooks/assigners/useSeatChart";
import { seatChartsListQueryKey } from "@/hooks/assigners/useSeatCharts";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { SeatChart, SeatChartAssignment, SeatChartList } from "@/lib/assigners/seatCharts";
import { messageFromError } from "@/lib/errors/convexError";

type SaveSeatChartDraftArgs = {
  classId: Id<"classes">;
  chartId: Id<"seatCharts">;
  assignments: Array<SeatChartAssignment>;
};

export function useSaveSeatChartDraft() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.seatCharts.saveDraft);

  return useOptimisticMutation({
    mutationFn: (args: SaveSeatChartDraftArgs) => mutationFn(args),
    queryKeys: (args) => [
      seatChartQueryKey(args.classId, args.chartId),
      seatChartsListQueryKey(args.classId),
      seatChartsListQueryKey(args.classId, true),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const now = Date.now();
      queryClient.setQueryData<SeatChart>(seatChartQueryKey(args.classId, args.chartId), (old) =>
        old
          ? {
              ...old,
              assignments: args.assignments,
              updatedAt: now,
            }
          : old,
      );
      const patchList = (includeArchived?: boolean) => {
        queryClient.setQueryData<SeatChartList>(
          seatChartsListQueryKey(args.classId, includeArchived),
          (old) =>
            old?.map((chart) =>
              chart._id === args.chartId
                ? { ...chart, seatedCount: args.assignments.length, updatedAt: now }
                : chart,
            ),
        );
      };
      patchList(false);
      patchList(true);
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("chartSaveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
