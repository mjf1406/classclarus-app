import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import { SeatChartRecordConfirmCredenza } from "@/components/assigners/SeatChartRecordConfirmCredenza";
import { SeatAutoAssignFailureCredenza } from "@/components/assigners/SeatAutoAssignFailureCredenza";
import {
  SeatLayoutPrintCredenza,
  type SeatLayoutPrintSelection,
} from "@/components/assigners/SeatLayoutPrintCredenza";
import { useClass } from "@/hooks/classes/useClass";
import { useGroupsBoard } from "@/hooks/groups/useGroupsBoard";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { useStudentRoster } from "@/hooks/roster/useStudentRoster";
import { useLogClassAccess } from "@/hooks/activity/useLogClassAccess";
import type {
  AutoAssignPendingRecord,
  AutoAssignPrintTarget,
} from "@/hooks/assigners/useRunAutoAssignSeatingFlow";
import type { AutoAssignFailureState } from "@/lib/assigners/seating/autoAssignRecovery";
import type { SeatingRelaxableRule } from "../../../convex/lib/seating/types";
import { buildSeatChartPrintItems, printSeatChart } from "@/lib/assigners/seatChartPrint";
import { resolveRosterNameFormat } from "@/lib/roster/roster";
import type { SeatOrientation } from "@/lib/assigners/seatLayouts";
import type { Id } from "../../../convex/_generated/dataModel";
import { FIVE_MINUTES } from "@/lib/queryCache";

type AutoAssignSeatingDialogsProps = {
  classId: Id<"classes">;
  recordConfirmOpen: boolean;
  onRecordConfirmOpenChange: (open: boolean) => void;
  pendingRecord: AutoAssignPendingRecord | null;
  onConfirmRecord: () => Promise<void>;
  printTarget: AutoAssignPrintTarget | null;
  onDismissPrint: () => void;
  currentOrientation?: SeatOrientation;
  failureOpen: boolean;
  onFailureOpenChange: (open: boolean) => void;
  failureState: AutoAssignFailureState | null;
  selectedFailureRules: Array<SeatingRelaxableRule>;
  onSelectedFailureRulesChange: (rules: Array<SeatingRelaxableRule>) => void;
  isAutoAssignRunning: boolean;
  onRetryUnchanged: () => Promise<AutoAssignPendingRecord | null>;
  onGenerateWithExceptions: () => Promise<AutoAssignPendingRecord | null>;
  onDismissFailure: () => void;
  onAutoAssignSucceeded?: (args: {
    chartId: Id<"seatCharts">;
    assignments: import("@/lib/assigners/seatCharts").SeatChartAssignment[];
  }) => void;
};

export function AutoAssignSeatingDialogs({
  classId,
  recordConfirmOpen,
  onRecordConfirmOpenChange,
  pendingRecord,
  onConfirmRecord,
  printTarget,
  onDismissPrint,
  currentOrientation = "front",
  failureOpen,
  onFailureOpenChange,
  failureState,
  selectedFailureRules,
  onSelectedFailureRulesChange,
  isAutoAssignRunning,
  onRetryUnchanged,
  onGenerateWithExceptions,
  onDismissFailure,
  onAutoAssignSucceeded,
}: AutoAssignSeatingDialogsProps) {
  const { t } = useTranslation("assigners");
  const { data: classDoc } = useClass(classId);
  const { data: board } = useGroupsBoard(classId);
  const { data: roster } = useStudentRoster(classId);
  const { data: chart } = useAuthedQuery(
    api.seatCharts.get,
    printTarget ? { classId, chartId: printTarget.chartId } : "skip",
    { gcTime: FIVE_MINUTES },
  );
  const logAccess = useLogClassAccess();

  const handlePrint = async (selection: SeatLayoutPrintSelection) => {
    if (!chart || !board || !classDoc) return;
    const nameFormat = resolveRosterNameFormat(classDoc);
    const items = buildSeatChartPrintItems({
      layoutItems: chart.layout.items,
      assignments: chart.assignments.map((assignment) => ({
        deskItemId: assignment.deskItemId,
        groupId: assignment.groupId!,
        studentUserId: assignment.studentUserId,
      })),
      roster: roster ?? [],
      board,
      nameFormat,
      unnamedLabel: t("unnamedMember"),
      staleTeamLabel: t("teamStale"),
    });

    await printSeatChart({
      selection,
      canvasWidth: chart.layout.canvasWidth,
      canvasHeight: chart.layout.canvasHeight,
      items,
      labels: {
        documentTitle: chart.name,
        heading: chart.name,
        subtitle: chart.layout.name,
        logoAlt: t("printLogoAlt"),
        orientationLabels: {
          front: t("orientationFront"),
          back: t("orientationBack"),
          left: t("orientationLeft"),
          right: t("orientationRight"),
        },
      },
    });

    void logAccess.mutateAsync({
      classId,
      resourceType: "seatChart",
      resourceId: chart._id,
      summary: `Exported seating chart "${chart.name}" PDF`,
      summaryKey: "activitySummary_exportedSeatChartPdf",
      metadata: { chartName: chart.name },
    });

    onDismissPrint();
  };

  return (
    <>
      <SeatAutoAssignFailureCredenza
        classId={classId}
        open={failureOpen}
        onOpenChange={onFailureOpenChange}
        failure={failureState}
        selectedRules={selectedFailureRules}
        onSelectedRulesChange={onSelectedFailureRulesChange}
        isRunning={isAutoAssignRunning}
        onRetryUnchanged={async () => {
          const result = await onRetryUnchanged();
          if (result) {
            onAutoAssignSucceeded?.({
              chartId: result.chartId,
              assignments: result.assignments,
            });
          }
        }}
        onGenerateWithExceptions={async () => {
          const result = await onGenerateWithExceptions();
          if (result) {
            onAutoAssignSucceeded?.({
              chartId: result.chartId,
              assignments: result.assignments,
            });
          }
        }}
        onDismiss={onDismissFailure}
        layoutId={
          failureState?.context.layoutId ??
          (pendingRecord?.layoutId as Id<"seatLayouts"> | undefined) ??
          ("" as Id<"seatLayouts">)
        }
      />
      <SeatChartRecordConfirmCredenza
        classId={classId}
        open={recordConfirmOpen}
        onOpenChange={onRecordConfirmOpenChange}
        seatedCount={pendingRecord?.seatedCount ?? 0}
        unseatedCount={pendingRecord?.unseatedCount ?? 0}
        violations={pendingRecord?.violations ?? []}
        appliedRelaxations={pendingRecord?.appliedRelaxations}
        onConfirm={onConfirmRecord}
      />
      <SeatLayoutPrintCredenza
        open={printTarget !== null}
        onOpenChange={(open) => {
          if (!open) onDismissPrint();
        }}
        currentOrientation={currentOrientation}
        onConfirm={handlePrint}
      />
    </>
  );
}
