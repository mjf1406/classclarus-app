import type { Id } from "../../_generated/dataModel.js";
import type { ChartAssignment } from "../seatChartGeometry.js";
import { emptyStudentHistory } from "./history.js";
import { seatHistoryKey } from "./historyKeys.js";
import type {
  LayoutHistoryStats,
  SeatingAlgorithmInput,
  SeatingDeskSlot,
  SeatingStudent,
} from "./types.js";

export const TEST_LAYOUT_ID = "layout-test" as Id<"seatLayouts">;
export const TEST_GROUP_ID = "group-test" as Id<"groups">;

export function testStudent(index: number): SeatingStudent {
  return {
    studentUserId: `student-${index}` as Id<"users">,
    groupId: TEST_GROUP_ID,
    genderBucket: "unknown",
  };
}

export function testSlots(
  count: number,
  topology: "line" | "ring" | "complete" = "line",
): SeatingDeskSlot[] {
  return Array.from({ length: count }, (_, index) => {
    const deskItemId = `desk-${index}`;
    let neighborDeskIds: string[];
    if (topology === "complete") {
      neighborDeskIds = Array.from({ length: count }, (_, other) => `desk-${other}`).filter(
        (id) => id !== deskItemId,
      );
    } else {
      neighborDeskIds = [
        ...(index > 0 ? [`desk-${index - 1}`] : topology === "ring" ? [`desk-${count - 1}`] : []),
        ...(index + 1 < count ? [`desk-${index + 1}`] : topology === "ring" ? ["desk-0"] : []),
      ];
    }
    return {
      deskItemId,
      groupId: TEST_GROUP_ID,
      deskNumber: index + 1,
      zoneName: index % 2 === 0 ? "A" : "B",
      teamKey: index % 2 === 0 ? "name:One" : "name:Two",
      neighborDeskIds: [...new Set(neighborDeskIds)],
    };
  });
}

export function testInput(args: {
  studentCount: number;
  slotCount: number;
  seed?: string;
  topology?: "line" | "ring" | "complete";
  history?: LayoutHistoryStats;
}): SeatingAlgorithmInput {
  return {
    layoutId: TEST_LAYOUT_ID,
    slots: testSlots(args.slotCount, args.topology),
    students: Array.from({ length: args.studentCount }, (_, index) => testStudent(index)),
    locked: [],
    constraints: [],
    history: args.history ?? { byStudent: new Map() },
    scope: { kind: "class" },
    genderParityMode: "off",
    genderParityAssignment: { malesOnOddDesks: true },
    randomSeed: args.seed ?? "test",
  };
}

export function expectStructuralInvariants(
  input: SeatingAlgorithmInput,
  assignments: ReadonlyArray<ChartAssignment>,
): void {
  if (new Set(assignments.map((row) => row.studentUserId)).size !== assignments.length) {
    throw new Error("Duplicate student assignment");
  }
  if (
    new Set(assignments.map((row) => `${row.groupId}:${row.deskItemId}`)).size !==
    assignments.length
  ) {
    throw new Error("Duplicate slot assignment");
  }
  const students = new Map(input.students.map((student) => [student.studentUserId, student]));
  const slots = new Set(input.slots.map((slot) => `${slot.groupId}:${slot.deskItemId}`));
  for (const assignment of assignments) {
    if (students.get(assignment.studentUserId)?.groupId !== assignment.groupId) {
      throw new Error("Student assigned outside their group");
    }
    if (!slots.has(`${assignment.groupId}:${assignment.deskItemId}`)) {
      throw new Error("Assignment references an unavailable slot");
    }
  }
}

function cloneHistory(history: LayoutHistoryStats): LayoutHistoryStats {
  return {
    byStudent: new Map(
      [...history.byStudent].map(([studentId, values]) => [
        studentId,
        {
          seat: new Map(values.seat),
          zone: new Map(values.zone),
          team: new Map(values.team),
          neighbor: new Map(values.neighbor),
          combination: new Map(values.combination),
          total: values.total,
        },
      ]),
    ),
  };
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export function recordAssignmentsInHistory(
  input: SeatingAlgorithmInput,
  assignments: ReadonlyArray<ChartAssignment>,
): LayoutHistoryStats {
  const next = cloneHistory(input.history);
  const slotByDesk = new Map(input.slots.map((slot) => [slot.deskItemId, slot]));
  const assignmentByStudent = new Map(
    assignments.map((assignment) => [assignment.studentUserId, assignment]),
  );
  for (const assignment of assignments) {
    const slot = slotByDesk.get(assignment.deskItemId);
    if (!slot) continue;
    let studentHistory = next.byStudent.get(assignment.studentUserId);
    if (!studentHistory) {
      studentHistory = emptyStudentHistory();
      next.byStudent.set(assignment.studentUserId, studentHistory);
    }
    increment(studentHistory.seat, seatHistoryKey(input.layoutId, assignment.deskItemId));
    if (slot.zoneName) increment(studentHistory.zone, slot.zoneName);
    if (slot.teamKey) increment(studentHistory.team, slot.teamKey);
    studentHistory.total += 1;
    for (const [otherId, otherAssignment] of assignmentByStudent) {
      if (
        otherId !== assignment.studentUserId &&
        otherAssignment.groupId === assignment.groupId &&
        slot.neighborDeskIds.includes(otherAssignment.deskItemId)
      ) {
        const previous = studentHistory.neighbor.get(otherId) ?? 0;
        studentHistory.neighbor.set(otherId, previous + 1);
      }
    }
  }
  return next;
}
