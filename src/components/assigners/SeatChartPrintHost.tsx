import { convexQuery } from "@convex-dev/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  SeatLayoutPrintCredenza,
  type SeatChartPrintOutput,
  type SeatLayoutPrintSelection,
} from "@/components/assigners/SeatLayoutPrintCredenza";
import { toast } from "@/components/ui/toast-manager";
import { useLogClassAccess } from "@/hooks/activity/useLogClassAccess";
import { useClass } from "@/hooks/classes/useClass";
import { useGroupsBoard } from "@/hooks/groups/useGroupsBoard";
import { useStudentRoster } from "@/hooks/roster/useStudentRoster";
import { buildSeatChartPrintItems, printSeatChart } from "@/lib/assigners/seatChartPrint";
import {
  buildSeatChartPrintTableMatrix,
  printSeatChartTable,
} from "@/lib/assigners/seatChartTablePrint";
import type { SeatChart } from "@/lib/assigners/seatCharts";
import type { SeatOrientation } from "@/lib/assigners/seatLayouts";
import { messageFromError } from "@/lib/errors/convexError";
import { resolveRosterNameFormat } from "@/lib/roster/roster";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export type SeatChartPrintMode = "layout" | "table" | "choose";

const CHART_PRINT_OUTPUTS: Array<SeatChartPrintOutput> = ["layout", "table"];

function initialOutputsForMode(mode: SeatChartPrintMode): Array<SeatChartPrintOutput> {
  if (mode === "table") return ["table"];
  if (mode === "choose") return ["layout", "table"];
  return ["layout"];
}

function chartAssignments(assignments: SeatChart["assignments"]) {
  return assignments.map((assignment) => ({
    deskItemId: assignment.deskItemId,
    groupId: assignment.groupId!,
    studentUserId: assignment.studentUserId,
  }));
}

type SeatChartPrintHostProps = {
  classId: Id<"classes">;
  chartId: Id<"seatCharts"> | null;
  mode: SeatChartPrintMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentOrientation?: SeatOrientation;
};

/**
 * Print options + export for an existing seating chart (list menus, post-auto-assign, etc.).
 */
export function SeatChartPrintHost({
  classId,
  chartId,
  mode,
  open,
  onOpenChange,
  currentOrientation = "front",
}: SeatChartPrintHostProps) {
  const { t } = useTranslation("assigners");
  const { t: tClasses } = useTranslation("classes");
  const queryClient = useQueryClient();
  const { data: classDoc } = useClass(classId);
  const { data: board } = useGroupsBoard(classId);
  const { data: roster } = useStudentRoster(classId);
  const logAccess = useLogClassAccess();
  const logAccessMutate = logAccess.mutateAsync;
  const initialOutputs = useMemo(() => initialOutputsForMode(mode), [mode]);

  const fetchChart = useCallback(async () => {
    if (!chartId) {
      throw new Error("chart id missing");
    }
    return await queryClient.fetchQuery(convexQuery(api.seatCharts.get, { classId, chartId }));
  }, [chartId, classId, queryClient]);

  const handleLayoutPrint = useCallback(
    async (selection: SeatLayoutPrintSelection) => {
      if (!chartId || !board || !classDoc) {
        toast.add({ title: t("printPdfFailed"), type: "error" });
        throw new Error("print prerequisites missing");
      }

      try {
        const chart = await fetchChart();
        const nameFormat = resolveRosterNameFormat(classDoc);
        const items = buildSeatChartPrintItems({
          layoutItems: chart.layout.items,
          assignments: chartAssignments(chart.assignments),
          roster: roster ?? [],
          board,
          nameFormat,
          unnamedLabel: tClasses("unnamedMember"),
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

        void logAccessMutate({
          classId,
          resourceType: "seatChart",
          resourceId: chart._id,
          summary: `Exported seating chart "${chart.name}" PDF`,
          summaryKey: "activitySummary_exportedSeatChartPdf",
          metadata: { chartName: chart.name },
        });
      } catch (error) {
        toast.add({
          title: messageFromError(error, t("printPdfFailed")),
          type: "error",
        });
        throw error instanceof Error ? error : new Error("print failed");
      }
    },
    [board, chartId, classDoc, classId, fetchChart, logAccessMutate, roster, t, tClasses],
  );

  const handleTablePrint = useCallback(async () => {
    if (!chartId || !board || !classDoc) {
      toast.add({ title: t("printPdfFailed"), type: "error" });
      throw new Error("print prerequisites missing");
    }

    try {
      const chart = await fetchChart();
      const nameFormat = resolveRosterNameFormat(classDoc);
      const matrix = buildSeatChartPrintTableMatrix({
        layoutItems: chart.layout.items,
        assignments: chartAssignments(chart.assignments),
        roster: roster ?? [],
        board,
        nameFormat,
        unnamedLabel: tClasses("unnamedMember"),
      });

      await printSeatChartTable(matrix, {
        documentTitle: chart.name,
        heading: chart.name,
        subtitle: chart.layout.name,
        seatColumn: t("printTableSeatColumn"),
        logoAlt: t("printLogoAlt"),
      });

      void logAccessMutate({
        classId,
        resourceType: "seatChart",
        resourceId: chart._id,
        summary: `Exported seating chart "${chart.name}" table PDF`,
        summaryKey: "activitySummary_exportedSeatChartTablePdf",
        metadata: { chartName: chart.name },
      });
    } catch (error) {
      toast.add({
        title: messageFromError(error, t("printPdfFailed")),
        type: "error",
      });
      throw error instanceof Error ? error : new Error("print failed");
    }
  }, [board, chartId, classDoc, classId, fetchChart, logAccessMutate, roster, t, tClasses]);

  const handleConfirm = useCallback(
    async (selection: SeatLayoutPrintSelection) => {
      if (selection.outputs.includes("layout")) {
        await handleLayoutPrint(selection);
      }
      if (selection.outputs.includes("table")) {
        await handleTablePrint();
      }
    },
    [handleLayoutPrint, handleTablePrint],
  );

  return (
    <SeatLayoutPrintCredenza
      open={open}
      onOpenChange={onOpenChange}
      currentOrientation={currentOrientation}
      availableOutputs={CHART_PRINT_OUTPUTS}
      initialOutputs={initialOutputs}
      onConfirm={handleConfirm}
    />
  );
}
