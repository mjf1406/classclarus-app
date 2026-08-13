import { AutoAssignSeatingDialogs } from "@/components/assigners/AutoAssignSeatingDialogs";
import {
  SeatAutoAssignSetupCredenza,
  type SeatAutoAssignMode,
} from "@/components/assigners/SeatAutoAssignSetupCredenza";
import type { AutoAssignSeatingFlow } from "@/hooks/assigners/useRunAutoAssignSeatingFlow";
import { runContextFromSetup } from "@/lib/assigners/seating/autoAssignRecovery";
import type { SeatChartAssignment } from "@/lib/assigners/seatCharts";
import type { SeatOrientation } from "@/lib/assigners/seatLayouts";
import type { Id } from "../../../convex/_generated/dataModel";

type AutoAssignSeatingHostProps = {
  classId: Id<"classes">;
  flow: AutoAssignSeatingFlow;
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
  flow,
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
          const result = await flow.runAutoAssign(context);
          if (result) {
            onGenerated?.({
              chartId: result.chartId,
              assignments: result.assignments,
            });
          }
        }}
        isRunning={flow.isRunning}
      />
      <AutoAssignSeatingDialogs
        classId={classId}
        recordConfirmOpen={flow.recordConfirmOpen}
        onRecordConfirmOpenChange={flow.setRecordConfirmOpen}
        pendingRecord={flow.pendingRecord}
        onConfirmRecord={flow.confirmPendingRecord}
        printTarget={flow.printTarget}
        onDismissPrint={flow.dismissPrint}
        currentOrientation={currentOrientation}
        failureOpen={flow.failureOpen}
        onFailureOpenChange={flow.setFailureOpen}
        failureState={flow.failureState}
        selectedFailureRules={flow.failureState?.selectedRules ?? []}
        onSelectedFailureRulesChange={flow.updateFailureSelectedRules}
        isAutoAssignRunning={flow.isRunning}
        onRetryUnchanged={flow.retryUnchanged}
        onGenerateWithExceptions={flow.retryWithSelectedRules}
        onDismissFailure={flow.dismissFailure}
        onAutoAssignSucceeded={onGenerated}
      />
    </>
  );
}
