import type { Id } from "../../_generated/dataModel.js";
import type { ChartAssignment } from "../seatChartGeometry.js";
import { slotKey } from "../seatChartGeometry.js";

export function mergeAlgorithmAssignments(args: {
  locked: ReadonlyArray<ChartAssignment>;
  proposed: ReadonlyArray<ChartAssignment>;
  movableStudentIds: ReadonlySet<Id<"users">>;
}): Array<ChartAssignment> {
  const lockedSlotKeys = new Set(
    args.locked.map((assignment) => slotKey(assignment.deskItemId, assignment.groupId)),
  );
  const lockedStudents = new Set(args.locked.map((assignment) => assignment.studentUserId));
  const usedSlots = new Set(lockedSlotKeys);
  const usedStudents = new Set(lockedStudents);
  const merged = [...args.locked.map((assignment) => ({ ...assignment }))];

  for (const assignment of args.proposed) {
    if (!args.movableStudentIds.has(assignment.studentUserId)) continue;
    if (lockedStudents.has(assignment.studentUserId)) continue;
    const key = slotKey(assignment.deskItemId, assignment.groupId);
    if (lockedSlotKeys.has(key)) continue;
    if (usedSlots.has(key)) continue;
    if (usedStudents.has(assignment.studentUserId)) continue;
    merged.push({ ...assignment });
    usedSlots.add(key);
    usedStudents.add(assignment.studentUserId);
  }

  return merged;
}
