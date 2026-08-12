import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { useCreateSeatChart } from "@/hooks/assigners/useCreateSeatChart";
import { useSaveSeatChartDraft } from "@/hooks/assigners/useSaveSeatChartDraft";
import { useSeatChartRecordFlow } from "@/hooks/assigners/useSeatChartRecordFlow";
import { useLoadSeatConstraints, useSeatConstraints } from "@/hooks/assigners/useSeatConstraints";
import { useSeatAlgorithmData } from "@/hooks/assigners/useSeatAlgorithmData";
import { useGroupsBoard } from "@/hooks/groups/useGroupsBoard";
import { useStudentRoster } from "@/hooks/roster/useStudentRoster";
import {
  defaultSelectedRules,
  pruneSelectedRulesForConstraints,
  relaxationsFromSelectedRules,
  type AutoAssignFailureState,
  type AutoAssignRunContext,
} from "@/lib/assigners/seating/autoAssignRecovery";
import { studentContextsForEvidence } from "@/lib/assigners/seating/failureStudentContext";
import { runClientSeatingAlgorithm } from "@/lib/assigners/seating/runClientSeatingAlgorithm";
import type { SeatChartAssignment, SeatChartViolation } from "@/lib/assigners/seatCharts";
import { groupedStudentCount } from "@/lib/assigners/seatAssignmentScope";
import type { SeatingRelaxations } from "../../../convex/lib/seating/types";
import type { SeatLayoutItemSnapshot } from "../../../convex/lib/seatChartGeometry";

export type AutoAssignPendingRecord = {
  classId: Id<"classes">;
  chartId: Id<"seatCharts">;
  layoutId: Id<"seatLayouts">;
  assignments: Array<SeatChartAssignment>;
  violations: Array<SeatChartViolation>;
  seatedCount: number;
  unseatedCount: number;
  /** Temporary rule exceptions used to produce this chart (not saved to class constraints). */
  appliedRelaxations?: SeatingRelaxations;
};

export type AutoAssignPrintTarget = {
  chartId: Id<"seatCharts">;
  recordId: Id<"seatChartRecords">;
};

export function useRunAutoAssignSeatingFlow(classId: Id<"classes">) {
  const { t } = useTranslation("assigners");
  const { data: board } = useGroupsBoard(classId);
  const { data: roster } = useStudentRoster(classId);
  const { data: constraints } = useSeatConstraints(classId);
  const { load: loadSeatConstraints } = useLoadSeatConstraints();
  const createChart = useCreateSeatChart();
  const saveDraft = useSaveSeatChartDraft();
  const { previewViolations, record } = useSeatChartRecordFlow();
  const { load: loadAlgorithmData, invalidateHistory } = useSeatAlgorithmData();

  const [recordConfirmOpen, setRecordConfirmOpen] = useState(false);
  const [pendingRecord, setPendingRecord] = useState<AutoAssignPendingRecord | null>(null);
  const [printTarget, setPrintTarget] = useState<AutoAssignPrintTarget | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [failureState, setFailureState] = useState<AutoAssignFailureState | null>(null);
  const [failureOpen, setFailureOpen] = useState(false);

  useEffect(() => {
    if (!constraints) return;
    setFailureState((current) => {
      if (!current) return current;
      const pruned = pruneSelectedRulesForConstraints(current.selectedRules, constraints);
      if (pruned.length === current.selectedRules.length) return current;
      return { ...current, selectedRules: pruned };
    });
  }, [constraints]);

  const finalizeRecord = useCallback(
    async (pending: AutoAssignPendingRecord) => {
      const recordId = await record({
        classId: pending.classId,
        chartId: pending.chartId,
        assignments: pending.assignments,
      });
      await invalidateHistory(pending.classId, pending.layoutId);
      setPrintTarget({ chartId: pending.chartId, recordId });
      return recordId;
    },
    [record, invalidateHistory],
  );

  const executeAutoAssign = useCallback(
    async (
      context: AutoAssignRunContext,
      relaxations?: SeatingRelaxations,
    ): Promise<AutoAssignPendingRecord | null> => {
      if (!board) {
        toast.add({ type: "error", title: t("autoAssignFailed") });
        return null;
      }

      const { layout, layoutAggregateRows } = await loadAlgorithmData(
        context.classId,
        context.layoutId,
      );
      if (!layout) {
        toast.add({ type: "error", title: t("autoAssignFailed") });
        return null;
      }

      const activeConstraints = await loadSeatConstraints(context.classId);

      const algorithmResult = runClientSeatingAlgorithm({
        layout: {
          _id: layout._id,
          items: layout.items as Array<SeatLayoutItemSnapshot>,
          genderParity: layout.genderParity,
        },
        board,
        constraints: activeConstraints,
        lockedAssignments: context.lockedAssignments,
        layoutAggregateRows,
        relaxations,
      });

      if (algorithmResult.status === "invalid") {
        const diagnosis = algorithmResult.diagnosis;
        const evidence =
          diagnosis.status === "structural"
            ? diagnosis.evidence
            : diagnosis.status === "unknown"
              ? diagnosis.evidence
              : undefined;
        const rosterUserIds = new Set((roster ?? []).map((student) => student.userId));
        const solverStudentIds = new Set(algorithmResult.solverStudentIds);
        const studentContexts = studentContextsForEvidence(
          evidence,
          board,
          rosterUserIds,
          solverStudentIds,
        );
        setFailureState({
          context,
          diagnosis,
          code: algorithmResult.code,
          selectedRules: defaultSelectedRules(diagnosis),
          studentContexts,
        });
        setFailureOpen(true);
        return null;
      }

      setFailureState(null);
      setFailureOpen(false);

      const assignments = algorithmResult.assignments;
      let chartId = context.targetChartId;

      if (chartId) {
        await saveDraft.mutateAsync({
          classId: context.classId,
          chartId,
          assignments,
        });
      } else {
        chartId = await createChart.mutateAsync({
          classId: context.classId,
          name: context.chartName,
          layoutId: context.layoutId,
        });
        await saveDraft.mutateAsync({
          classId: context.classId,
          chartId,
          assignments,
        });
      }

      const seatedCount = assignments.length;
      const unseatedCount = Math.max(0, groupedStudentCount(board) - seatedCount);
      const violations = await previewViolations({
        classId: context.classId,
        chartId,
        assignments,
      });

      const pending: AutoAssignPendingRecord = {
        classId: context.classId,
        chartId,
        layoutId: context.layoutId,
        assignments,
        violations,
        seatedCount,
        unseatedCount,
        ...(algorithmResult.appliedRelaxations
          ? { appliedRelaxations: algorithmResult.appliedRelaxations }
          : {}),
      };

      if (violations.length > 0) {
        setPendingRecord(pending);
        setRecordConfirmOpen(true);
        return pending;
      }

      await finalizeRecord(pending);
      return pending;
    },
    [
      board,
      roster,
      loadSeatConstraints,
      loadAlgorithmData,
      createChart,
      saveDraft,
      previewViolations,
      finalizeRecord,
      t,
    ],
  );

  const runAutoAssign = useCallback(
    async (context: AutoAssignRunContext) => {
      setIsRunning(true);
      try {
        return await executeAutoAssign(context);
      } finally {
        setIsRunning(false);
      }
    },
    [executeAutoAssign],
  );

  const retryWithSelectedRules = useCallback(async () => {
    if (!failureState) return null;
    const relaxations = relaxationsFromSelectedRules(failureState.selectedRules);
    setIsRunning(true);
    try {
      return await executeAutoAssign(failureState.context, relaxations);
    } finally {
      setIsRunning(false);
    }
  }, [failureState, executeAutoAssign]);

  const retryUnchanged = useCallback(async () => {
    if (!failureState) return null;
    setIsRunning(true);
    try {
      return await executeAutoAssign(failureState.context);
    } finally {
      setIsRunning(false);
    }
  }, [failureState, executeAutoAssign]);

  const updateFailureSelectedRules = useCallback(
    (rules: AutoAssignFailureState["selectedRules"]) => {
      setFailureState((current) => (current ? { ...current, selectedRules: rules } : current));
    },
    [],
  );

  const dismissFailure = useCallback(() => {
    setFailureOpen(false);
    setFailureState(null);
  }, []);

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
    retryWithSelectedRules,
    retryUnchanged,
    updateFailureSelectedRules,
    dismissFailure,
    confirmPendingRecord,
    isRunning: isRunning || createChart.isPending || saveDraft.isPending,
    recordConfirmOpen,
    setRecordConfirmOpen,
    pendingRecord,
    printTarget,
    dismissPrint,
    failureState,
    failureOpen,
    setFailureOpen,
  };
}
