import type { Id } from "../../_generated/dataModel.js";
import type { SeatLayoutItemSnapshot } from "./seatChartGeometry.js";

export function seatHistoryKey(layoutId: Id<"seatLayouts">, deskItemId: string): string {
  return `${layoutId}:${deskItemId}`;
}

export function teamHistoryKey(
  groupId: Id<"groups"> | undefined,
  assignment: SeatLayoutItemSnapshot["teamAssignment"],
): string | undefined {
  if (!assignment) return undefined;
  if (assignment.mode === "single") {
    return groupId !== undefined && assignment.groupId === groupId
      ? `g:${assignment.groupId}:t:${assignment.teamId}`
      : undefined;
  }
  const teamName = assignment.teamName.trim();
  return teamName ? `name:${teamName}` : undefined;
}
