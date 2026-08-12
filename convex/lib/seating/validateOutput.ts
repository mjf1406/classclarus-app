import type { Id } from "../../_generated/dataModel.js";
import type { ChartAssignment, SeatLayoutItemSnapshot } from "./seatChartGeometry.js";
import { slotKey } from "./seatChartGeometry.js";

export type ValidateAssignmentsError = {
  code: string;
  message: string;
};

export function validateMergedAssignments(args: {
  assignments: ReadonlyArray<ChartAssignment>;
  deskById: Map<string, SeatLayoutItemSnapshot>;
  membershipGroupByStudent: ReadonlyMap<Id<"users">, Id<"groups">>;
  lockedStudentUserIds: ReadonlySet<Id<"users">>;
  lockedAssignments: ReadonlyArray<ChartAssignment>;
}): ValidateAssignmentsError | null {
  const lockedByStudent = new Map(
    args.lockedAssignments.map((assignment) => [assignment.studentUserId, assignment]),
  );
  const seenSlots = new Set<string>();
  const seenStudents = new Set<string>();

  for (const assignment of args.assignments) {
    if (!args.deskById.has(assignment.deskItemId)) {
      return { code: "SEATING_INVALID_DESK", message: "Invalid desk" };
    }
    const membershipGroupId = args.membershipGroupByStudent.get(assignment.studentUserId);
    if (!membershipGroupId || membershipGroupId !== assignment.groupId) {
      return {
        code: "SEATING_INVALID_GROUP",
        message: "Student must be seated in their group slot",
      };
    }

    const locked = lockedByStudent.get(assignment.studentUserId);
    if (locked) {
      if (locked.deskItemId !== assignment.deskItemId || locked.groupId !== assignment.groupId) {
        return { code: "SEATING_LOCKED_MOVED", message: "Locked student moved" };
      }
    }

    const key = slotKey(assignment.deskItemId, assignment.groupId);
    if (seenSlots.has(key)) {
      return { code: "SEATING_DUPLICATE_SLOT", message: "Duplicate desk slot" };
    }
    if (seenStudents.has(assignment.studentUserId)) {
      return { code: "SEATING_DUPLICATE_STUDENT", message: "Duplicate student" };
    }
    seenSlots.add(key);
    seenStudents.add(assignment.studentUserId);
  }

  for (const studentUserId of args.lockedStudentUserIds) {
    const locked = lockedByStudent.get(studentUserId);
    const current = args.assignments.find((a) => a.studentUserId === studentUserId);
    if (!locked || !current) {
      return { code: "SEATING_LOCKED_MISSING", message: "Locked student missing from output" };
    }
    if (locked.deskItemId !== current.deskItemId || locked.groupId !== current.groupId) {
      return { code: "SEATING_LOCKED_MOVED", message: "Locked student moved" };
    }
  }

  return null;
}
