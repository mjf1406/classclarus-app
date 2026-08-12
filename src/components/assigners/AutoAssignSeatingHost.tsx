import { AutoAssignSeatingDialogs } from "@/components/assigners/AutoAssignSeatingDialogs";
import {
  SeatAutoAssignSetupCredenza,
  type SeatAutoAssignMode,
} from "@/components/assigners/SeatAutoAssignSetupCredenza";
import { useRunAutoAssignSeatingFlow } from "@/hooks/assigners/useRunAutoAssignSeatingFlow";
import { runContextFromSetup } from "@/lib/assigners/seating/autoAssignRecovery";
import type { SeatChartAssignment } from "@/lib/assigners/seatCharts";
import type { SeatOrientation } from "@/lib/assigners/seatLayouts";
import type { Id } from "../../../convex/_generated/dataModel";

type AutoAssignSeatingHostProps = {
  classId: Id<"classes">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: SeatAutoAssignMode;
  fixedLayoutId?: Id<"seatLayouts">;
  fixedLayoutName?: string;
  /**
   * Chart editor: update this chart in place (does not create a new chart).
   * Existing seats are preserved via lockedAssignments.
   */
  targetChartId?: Id<"seatCharts">;
  /** Draft seats to keep locked when updating an existing chart. */
  lockedAssignments?: Array<SeatChartAssignment>;
  /** Called after a successful generate so the chart editor can sync local draft state. */
  onGenerated?: (args: {
    chartId: Id<"seatCharts">;
    assignments: Array<SeatChartAssignment>;
  }) => void;
  currentOrientation?: SeatOrientation;
};

/**
 * Shared auto-assign entry: setup credenza + record/print follow-ups.
 * Algorithm runs on the client; persistence uses create + saveDraft.
 */
export function AutoAssignSeatingHost({
  classId,
  open,
  onOpenChange,
  mode = "create",
  fixedLayoutId,
  fixedLayoutName,
  targetChartId,
  lockedAssignments,
  onGenerated,
  currentOrientation,
}: AutoAssignSeatingHostProps) {
  const autoAssignFlow = useRunAutoAssignSeatingFlow(classId);
  const resolvedMode: SeatAutoAssignMode = targetChartId ? "update" : mode;

  return (
    <>
      <SeatAutoAssignSetupCredenza
        classId={classId}
        open={open}
        onOpenChange={onOpenChange}
        mode={resolvedMode}
        fixedLayoutId={fixedLayoutId}
        fixedLayoutName={fixedLayoutName}
        onSubmit={async (values) => {
          const context = runContextFromSetup(classId, values, {
            targetChartId,
            lockedAssignments,
          });
          const result = await autoAssignFlow.runAutoAssign(context);
          if (result) {
            onGenerated?.({
              chartId: result.chartId,
              assignments: result.assignments,
            });
          }
        }}
        isRunning={autoAssignFlow.isRunning}
      />
      <AutoAssignSeatingDialogs
        classId={classId}
        recordConfirmOpen={autoAssignFlow.recordConfirmOpen}
        onRecordConfirmOpenChange={autoAssignFlow.setRecordConfirmOpen}
        pendingRecord={autoAssignFlow.pendingRecord}
        onConfirmRecord={autoAssignFlow.confirmPendingRecord}
        printTarget={autoAssignFlow.printTarget}
        onDismissPrint={autoAssignFlow.dismissPrint}
        currentOrientation={currentOrientation}
        failureOpen={autoAssignFlow.failureOpen}
        onFailureOpenChange={autoAssignFlow.setFailureOpen}
        failureState={autoAssignFlow.failureState}
        selectedFailureRules={autoAssignFlow.failureState?.selectedRules ?? []}
        onSelectedFailureRulesChange={autoAssignFlow.updateFailureSelectedRules}
        isAutoAssignRunning={autoAssignFlow.isRunning}
        onRetryUnchanged={autoAssignFlow.retryUnchanged}
        onGenerateWithExceptions={autoAssignFlow.retryWithSelectedRules}
        onDismissFailure={autoAssignFlow.dismissFailure}
        onAutoAssignSucceeded={onGenerated}
      />
    </>
  );
}
