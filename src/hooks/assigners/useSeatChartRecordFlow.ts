import { useCallback } from "react";
import { useConvex } from "convex/react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useRecordSeatChart } from "@/hooks/assigners/useRecordSeatChart";
import type { SeatChartAssignment, SeatChartViolation } from "@/lib/assigners/seatCharts";

type RecordFlowArgs = {
  classId: Id<"classes">;
  chartId: Id<"seatCharts">;
  assignments: Array<SeatChartAssignment>;
};

export function useSeatChartRecordFlow() {
  const convex = useConvex();
  const recordSeating = useRecordSeatChart();

  const previewViolations = useCallback(
    async (args: RecordFlowArgs): Promise<Array<SeatChartViolation>> => {
      return await convex.query(api.seatCharts.previewViolations, {
        classId: args.classId,
        chartId: args.chartId,
        assignments: args.assignments,
      });
    },
    [convex],
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
