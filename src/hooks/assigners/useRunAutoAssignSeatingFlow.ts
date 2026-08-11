import { useCallback, useState } from "react";
import { useConvex } from "convex/react";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { useCreateSeatChart } from "@/hooks/assigners/useCreateSeatChart";
import { useSaveSeatChartDraft } from "@/hooks/assigners/useSaveSeatChartDraft";
import { useSeatAlgorithmSettings } from "@/hooks/assigners/useSeatAlgorithmSettings";
import { useSeatChartRecordFlow } from "@/hooks/assigners/useSeatChartRecordFlow";
import { useSeatConstraints } from "@/hooks/assigners/useSeatConstraints";
import { useGroupsBoard } from "@/hooks/groups/useGroupsBoard";
import { runClientSeatingAlgorithm } from "@/lib/assigners/seating/runClientSeatingAlgorithm";
import type { SeatChartAssignment, SeatChartViolation } from "@/lib/assigners/seatCharts";
import { groupedStudentCount } from "@/lib/assigners/seatAssignmentScope";
import type { SeatLayoutItemSnapshot } from "../../../convex/lib/seatChartGeometry";

export type AutoAssignPendingRecord = {
  classId: Id<"classes">;
  chartId: Id<"seatCharts">;
  assignments: Array<SeatChartAssignment>;
  violations: Array<SeatChartViolation>;
  seatedCount: number;
  unseatedCount: number;
};

export type AutoAssignPrintTarget = {
  chartId: Id<"seatCharts">;
  recordId: Id<"seatChartRecords">;
};

type RunAutoAssignArgs = {
  classId: Id<"classes">;
  layoutId: Id<"seatLayouts">;
  layoutName: string;
  chartName: string;
  /** Update this chart in place (chart editor). */
  targetChartId?: Id<"seatCharts">;
  /** Seats to keep locked when updating. */
  lockedAssignments?: Array<SeatChartAssignment>;
};

export function useRunAutoAssignSeatingFlow(classId: Id<"classes">) {
  const { t } = useTranslation("assigners");
  const convex = useConvex();
  const { data: board } = useGroupsBoard(classId);
  const { data: settings } = useSeatAlgorithmSettings(classId);
  const { data: constraints } = useSeatConstraints(classId);
  const createChart = useCreateSeatChart();
  const saveDraft = useSaveSeatChartDraft();
  const { previewViolations, record } = useSeatChartRecordFlow();

  const [recordConfirmOpen, setRecordConfirmOpen] = useState(false);
  const [pendingRecord, setPendingRecord] = useState<AutoAssignPendingRecord | null>(null);
  const [printTarget, setPrintTarget] = useState<AutoAssignPrintTarget | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const finalizeRecord = useCallback(
    async (pending: AutoAssignPendingRecord) => {
      const recordId = await record({
        classId: pending.classId,
        chartId: pending.chartId,
        assignments: pending.assignments,
      });
      setPrintTarget({ chartId: pending.chartId, recordId });
      return recordId;
    },
    [record],
  );

  const runAutoAssign = useCallback(
    async (args: RunAutoAssignArgs) => {
      if (!board) {
        toast.add({ type: "error", title: t("autoAssignFailed") });
        return null;
      }

      setIsRunning(true);
      try {
        const layout = await convex.query(api.seatLayouts.get, {
          classId: args.classId,
          layoutId: args.layoutId,
        });
        if (!layout) {
          toast.add({ type: "error", title: t("autoAssignFailed") });
          return null;
        }

        const lockedAssignments = args.lockedAssignments ?? [];

        const algorithmResult = runClientSeatingAlgorithm({
          layout: {
            _id: layout._id,
            items: layout.items as Array<SeatLayoutItemSnapshot>,
          },
          board,
          settings,
          constraints: constraints ?? [],
          lockedAssignments,
        });

        if (algorithmResult.status === "not_implemented") {
          toast.add({
            type: "error",
            title: t("autoAssignNotImplemented"),
            description: algorithmResult.message,
          });
          return null;
        }
        if (algorithmResult.status === "invalid") {
          toast.add({
            type: "error",
            title: t("autoAssignFailed"),
            description: algorithmResult.message,
          });
          return null;
        }

        const assignments = algorithmResult.assignments;
        let chartId = args.targetChartId;

        if (chartId) {
          await saveDraft.mutateAsync({
            classId: args.classId,
            chartId,
            assignments,
          });
        } else {
          chartId = await createChart.mutateAsync({
            classId: args.classId,
            name: args.chartName,
            layoutId: args.layoutId,
          });
          await saveDraft.mutateAsync({
            classId: args.classId,
            chartId,
            assignments,
          });
        }

        const seatedCount = assignments.length;
        const unseatedCount = Math.max(0, groupedStudentCount(board) - seatedCount);
        const violations = await previewViolations({
          classId: args.classId,
          chartId,
          assignments,
        });

        const pending: AutoAssignPendingRecord = {
          classId: args.classId,
          chartId,
          assignments,
          violations,
          seatedCount,
          unseatedCount,
        };

        if (violations.length > 0) {
          setPendingRecord(pending);
          setRecordConfirmOpen(true);
          return pending;
        }

        await finalizeRecord(pending);
        return pending;
      } finally {
        setIsRunning(false);
      }
    },
    [
      board,
      constraints,
      settings,
      convex,
      createChart,
      saveDraft,
      previewViolations,
      finalizeRecord,
      t,
    ],
  );

  const confirmPendingRecord = useCallback(async () => {
    if (!pendingRecord) return;
    await finalizeRecord(pendingRecord);
    setPendingRecord(null);
    setRecordConfirmOpen(false);
  }, [pendingRecord, finalizeRecord]);

  const dismissPrint = useCallback(() => {
    setPrintTarget(null);
  }, []);

  return {
    runAutoAssign,
    confirmPendingRecord,
    isRunning: isRunning || createChart.isPending || saveDraft.isPending,
    recordConfirmOpen,
    setRecordConfirmOpen,
    pendingRecord,
    printTarget,
    dismissPrint,
  };
}
