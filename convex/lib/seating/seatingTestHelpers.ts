import type { Id } from "../../_generated/dataModel.js";
import type { ChartAssignment, SeatLayoutItemSnapshot } from "./seatChartGeometry.js";
import { slotKey } from "./seatChartGeometry.js";
import { emptyStudentHistory } from "./history.js";
import { seatHistoryKey, teamHistoryKey } from "./historyKeys.js";
import { buildSeatingDeskSlots } from "./pipeline.js";
import type {
  LayoutHistoryStats,
  SeatingAlgorithmInput,
  SeatingConstraint,
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
  students?: SeatingStudent[];
  slots?: SeatingDeskSlot[];
  locked?: SeatingAlgorithmInput["locked"];
  constraints?: SeatingConstraint[];
  genderParityMode?: SeatingAlgorithmInput["genderParityMode"];
  malesOnOddDesks?: boolean;
}): SeatingAlgorithmInput {
  return {
    layoutId: TEST_LAYOUT_ID,
    slots: args.slots ?? testSlots(args.slotCount, args.topology),
    students:
      args.students ?? Array.from({ length: args.studentCount }, (_, index) => testStudent(index)),
    locked: args.locked ?? [],
    constraints: args.constraints ?? [],
    history: args.history ?? { byStudent: new Map() },
    scope: { kind: "class" },
    genderParityMode: args.genderParityMode ?? "off",
    genderParityAssignment: { malesOnOddDesks: args.malesOnOddDesks ?? true },
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

export function countSpread(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

export function compareFairnessVector(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function assignmentByStudentId(
  assignments: ReadonlyArray<ChartAssignment>,
): Map<Id<"users">, ChartAssignment> {
  return new Map(assignments.map((row) => [row.studentUserId, row]));
}

export function slotByDeskAndGroup(
  slots: ReadonlyArray<SeatingDeskSlot>,
): Map<string, SeatingDeskSlot> {
  return new Map(slots.map((slot) => [slotKey(slot.deskItemId, slot.groupId), slot]));
}

function independentlyAreNeighbors(left: SeatingDeskSlot, right: SeatingDeskSlot): boolean {
  return (
    left.deskItemId !== right.deskItemId &&
    (left.neighborDeskIds.includes(right.deskItemId) ||
      right.neighborDeskIds.includes(left.deskItemId))
  );
}

function independentlyAreTeammates(left: SeatingDeskSlot, right: SeatingDeskSlot): boolean {
  return (
    left.groupId === right.groupId &&
    left.deskItemId !== right.deskItemId &&
    left.teamKey !== undefined &&
    left.teamKey === right.teamKey
  );
}

function independentlyParityAllows(
  input: SeatingAlgorithmInput,
  student: Pick<SeatingStudent, "genderBucket">,
  slot: SeatingDeskSlot,
): boolean {
  if (input.genderParityMode === "off") return true;
  if (student.genderBucket !== "m" && student.genderBucket !== "f") return true;
  if (slot.deskNumber === undefined) return false;
  const odd = slot.deskNumber % 2 === 1;
  return student.genderBucket === "m"
    ? odd === input.genderParityAssignment.malesOnOddDesks
    : odd !== input.genderParityAssignment.malesOnOddDesks;
}

function independentlyConstraintHolds(
  constraint: SeatingConstraint,
  slotByStudent: Map<Id<"users">, SeatingDeskSlot>,
): boolean {
  const slot = slotByStudent.get(constraint.studentUserId);
  if (constraint.type === "zone") {
    if (!slot) return constraint.polarity === "mustNot";
    const matches = (slot.zoneName ?? "") === (constraint.zoneName?.trim() ?? "");
    return constraint.polarity === "must" ? matches : !matches;
  }
  const otherId = constraint.otherStudentUserId;
  const otherSlot = otherId ? slotByStudent.get(otherId) : undefined;
  if (!slot || !otherSlot) return constraint.polarity === "mustNot";
  const matches =
    constraint.type === "neighbor"
      ? independentlyAreNeighbors(slot, otherSlot)
      : independentlyAreTeammates(slot, otherSlot);
  return constraint.polarity === "must" ? matches : !matches;
}

export function expectHardConstraints(
  input: SeatingAlgorithmInput,
  assignments: ReadonlyArray<ChartAssignment>,
): void {
  const slots = slotByDeskAndGroup(input.slots);
  const slotByStudent = new Map<Id<"users">, SeatingDeskSlot>();
  const students = new Map(input.students.map((student) => [student.studentUserId, student]));
  for (const assignment of assignments) {
    const slot = slots.get(slotKey(assignment.deskItemId, assignment.groupId));
    if (!slot) {
      throw new Error(`Missing slot for ${assignment.studentUserId}`);
    }
    slotByStudent.set(assignment.studentUserId, slot);
    const student = students.get(assignment.studentUserId);
    if (student && !independentlyParityAllows(input, student, slot)) {
      throw new Error(
        `Parity violated for ${assignment.studentUserId} at ${assignment.deskItemId}`,
      );
    }
  }
  for (const constraint of input.constraints) {
    if (!independentlyConstraintHolds(constraint, slotByStudent)) {
      throw new Error(
        `Constraint ${constraint.id} (${constraint.type}/${constraint.polarity}) failed`,
      );
    }
  }
}

export function expectSolverLocksPreserved(
  input: SeatingAlgorithmInput,
  assignments: ReadonlyArray<ChartAssignment>,
): void {
  const lockedDesks = new Set(input.locked.map((row) => slotKey(row.deskItemId, row.groupId)));
  const lockedStudents = new Set(input.locked.map((row) => row.studentUserId));
  for (const assignment of assignments) {
    if (lockedStudents.has(assignment.studentUserId)) {
      throw new Error(`Solver reassigned locked student ${assignment.studentUserId}`);
    }
    if (lockedDesks.has(slotKey(assignment.deskItemId, assignment.groupId))) {
      throw new Error(`Solver reused locked slot ${assignment.deskItemId}`);
    }
  }
}

export function expectMergedLocksPreserved(
  locked: ReadonlyArray<ChartAssignment>,
  assignments: ReadonlyArray<ChartAssignment>,
): void {
  for (const row of locked) {
    const current = assignments.find(
      (assignment) => assignment.studentUserId === row.studentUserId,
    );
    if (!current) {
      throw new Error(`Locked student ${row.studentUserId} missing from merged chart`);
    }
    if (current.deskItemId !== row.deskItemId || current.groupId !== row.groupId) {
      throw new Error(`Locked student ${row.studentUserId} moved`);
    }
  }
}

export function expectValidSolverChart(
  input: SeatingAlgorithmInput,
  assignments: ReadonlyArray<ChartAssignment>,
): void {
  expectStructuralInvariants(input, assignments);
  expectSolverLocksPreserved(input, assignments);
  expectHardConstraints(input, assignments);
}

export function assignmentPermutations(
  input: SeatingAlgorithmInput,
  studentIndex = 0,
  used = new Set<string>(),
  rows: ChartAssignment[] = [],
): ChartAssignment[][] {
  if (studentIndex === input.students.length) return [[...rows]];
  const student = input.students[studentIndex]!;
  const results: ChartAssignment[][] = [];
  const eligibleSlots = input.slots.filter((slot) => slot.groupId === student.groupId);
  if (eligibleSlots.length === 0) {
    return assignmentPermutations(input, studentIndex + 1, used, rows);
  }
  let appended = false;
  for (const slot of eligibleSlots) {
    const identity = slotKey(slot.deskItemId, slot.groupId);
    if (used.has(identity)) continue;
    used.add(identity);
    rows.push({
      studentUserId: student.studentUserId,
      groupId: student.groupId,
      deskItemId: slot.deskItemId,
    });
    appended = true;
    results.push(...assignmentPermutations(input, studentIndex + 1, used, rows));
    rows.pop();
    used.delete(identity);
  }
  if (
    !appended &&
    eligibleSlots.every((slot) => used.has(slotKey(slot.deskItemId, slot.groupId)))
  ) {
    results.push(...assignmentPermutations(input, studentIndex + 1, used, rows));
  }
  return results;
}

export function classroomSlotsFromItems(args: {
  items: Array<SeatLayoutItemSnapshot>;
  groupIds: Array<Id<"groups">>;
}): SeatingDeskSlot[] {
  return buildSeatingDeskSlots({
    layoutItems: args.items,
    groupIds: args.groupIds,
    resolveTeamKey: (groupId, desk) => teamHistoryKey(groupId, desk.teamAssignment),
  });
}

export function neighborMapFromIds(
  neighborIds: Map<string, Array<string>>,
): Map<string, Array<string>> {
  return new Map([...neighborIds.entries()].map(([id, others]) => [id, [...others].sort()]));
}
