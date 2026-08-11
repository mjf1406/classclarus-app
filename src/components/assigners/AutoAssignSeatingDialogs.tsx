import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import { SeatChartRecordConfirmCredenza } from "@/components/assigners/SeatChartRecordConfirmCredenza";
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
      <SeatChartRecordConfirmCredenza
        open={recordConfirmOpen}
        onOpenChange={onRecordConfirmOpenChange}
        seatedCount={pendingRecord?.seatedCount ?? 0}
        unseatedCount={pendingRecord?.unseatedCount ?? 0}
        violations={pendingRecord?.violations ?? []}
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
