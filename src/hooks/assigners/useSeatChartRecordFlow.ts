import { useCallback } from "react";
import { convexQuery } from "@convex-dev/react-query";
import { useQueryClient } from "@tanstack/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useRecordSeatChart } from "@/hooks/assigners/useRecordSeatChart";
import type { SeatChartAssignment, SeatChartViolation } from "@/lib/assigners/seatCharts";
import { FIVE_MINUTES } from "@/lib/queryCache";

type RecordFlowArgs = {
  classId: Id<"classes">;
  chartId: Id<"seatCharts">;
  assignments: Array<SeatChartAssignment>;
};

export function useSeatChartRecordFlow() {
  const queryClient = useQueryClient();
  const recordSeating = useRecordSeatChart();

  const previewViolations = useCallback(
    async (args: RecordFlowArgs): Promise<Array<SeatChartViolation>> => {
      return await queryClient.fetchQuery({
        ...convexQuery(api.seatCharts.previewViolations, {
          classId: args.classId,
          chartId: args.chartId,
          assignments: args.assignments,
        }),
        gcTime: FIVE_MINUTES,
      });
    },
    [queryClient],
  );

  const record = useCallback(
    async (args: RecordFlowArgs): Promise<Id<"seatChartRecords">> => {
      return await recordSeating.mutateAsync({
        classId: args.classId,
        chartId: args.chartId,
        assignments: args.assignments,
      });
    },
    [recordSeating],
  );

  return {
    previewViolations,
    record,
    isRecording: recordSeating.isPending,
  };
}
