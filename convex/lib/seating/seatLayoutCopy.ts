import type { Id } from "../../_generated/dataModel.js";

export type SeatLayoutItemForCopy = {
  id: string;
  kind: "desk" | "teacherDesk" | "board" | "rect";
  label: string;
  deskNumber?: number;
  teamAssignment?:
    | { mode: "single"; groupId: Id<"groups">; teamId: Id<"teams"> }
    | { mode: "byName"; teamName: string };
  zoneName?: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Deep-copy layout items for a new class document.
 * When `preserveSingleTeamAssignments` is false (cross-class), drop
 * `mode: "single"` team links — those group/team IDs are class-scoped.
 * `byName` assignments and zone names are always kept.
 */
export function copySeatLayoutItems(
  items: readonly SeatLayoutItemForCopy[],
  options: { preserveSingleTeamAssignments: boolean },
): SeatLayoutItemForCopy[] {
  return items.map((item) => {
    const next: SeatLayoutItemForCopy = {
      id: item.id,
      kind: item.kind,
      label: item.label,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
    };
    if (item.deskNumber !== undefined) {
      next.deskNumber = item.deskNumber;
    }
    if (item.zoneName !== undefined) {
      next.zoneName = item.zoneName;
    }
    if (item.kind === "desk" && item.teamAssignment) {
      if (item.teamAssignment.mode === "byName") {
        next.teamAssignment = {
          mode: "byName",
          teamName: item.teamAssignment.teamName,
        };
      } else if (options.preserveSingleTeamAssignments) {
        next.teamAssignment = {
          mode: "single",
          groupId: item.teamAssignment.groupId,
          teamId: item.teamAssignment.teamId,
        };
      }
    }
    return next;
  });
}
