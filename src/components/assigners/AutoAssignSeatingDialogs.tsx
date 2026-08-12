import { SeatChartPrintHost } from "@/components/assigners/SeatChartPrintHost";
import { SeatChartRecordConfirmCredenza } from "@/components/assigners/SeatChartRecordConfirmCredenza";
import { SeatAutoAssignFailureCredenza } from "@/components/assigners/SeatAutoAssignFailureCredenza";
import type {
  AutoAssignPendingRecord,
  AutoAssignPrintTarget,
} from "@/hooks/assigners/useRunAutoAssignSeatingFlow";
import type { AutoAssignFailureState } from "@/lib/assigners/seating/autoAssignRecovery";
import type { SeatOrientation } from "@/lib/assigners/seatLayouts";
import type { SeatingRelaxableRule } from "../../../convex/lib/seating/types";
import type { Id } from "../../../convex/_generated/dataModel";

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
      <SeatChartPrintHost
        classId={classId}
        chartId={printTarget?.chartId ?? null}
        mode="layout"
        open={printTarget !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onDismissPrint();
        }}
        currentOrientation={currentOrientation}
      />
    </>
  );
}
