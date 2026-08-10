import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { seatChartQueryKey } from "@/hooks/assigners/useSeatChart";
import {
  seatChartStudentHistoryPrefixQueryKey,
  seatChartStudentSummaryQueryKey,
} from "@/hooks/assigners/useSeatChartStudentSummary";
import { seatChartsListQueryKey } from "@/hooks/assigners/useSeatCharts";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { SeatChart, SeatChartAssignment, SeatChartList } from "@/lib/assigners/seatCharts";
import { messageFromError } from "@/lib/errors/convexError";

type RecordSeatChartArgs = {
  classId: Id<"classes">;
  chartId: Id<"seatCharts">;
  assignments: Array<SeatChartAssignment>;
};

export function useRecordSeatChart() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.seatCharts.recordSeating);

  return useOptimisticMutation({
    mutationFn: (args: RecordSeatChartArgs) => mutationFn(args),
    queryKeys: (args) => [
      seatChartQueryKey(args.classId, args.chartId),
      seatChartsListQueryKey(args.classId),
      seatChartsListQueryKey(args.classId, true),
    ],
    invalidateQueryKeys: (args) => {
      const studentIds = [...new Set(args.assignments.map((a) => a.studentUserId))];
      return studentIds.flatMap((studentUserId) => [
        seatChartStudentSummaryQueryKey(
          args.classId,
          args.chartId,
          studentUserId,
          args.assignments,
        ),
        seatChartStudentHistoryPrefixQueryKey(args.classId, args.chartId, studentUserId),
      ]);
    },
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
                ? {
                    ...chart,
                    seatedCount: args.assignments.length,
                    recordCount: chart.recordCount + 1,
                    updatedAt: now,
                  }
                : chart,
            ),
        );
      };
      patchList(false);
      patchList(true);
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("chartRecordFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
