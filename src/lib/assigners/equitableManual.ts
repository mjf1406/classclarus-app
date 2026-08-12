import type { Id } from "../../../convex/_generated/dataModel";
import {
  assignmentsComplete,
  buildEquitableManualSlots,
  validateEquitableManualAssignments,
  type EquitableManualGenderBucket,
  type EquitableManualGroup,
  type EquitableManualSlot,
  type EquitableManualSlotAssignmentInput,
} from "../../../convex/lib/assigners/equitableManualSlots";
import type { EquitableAssignerScope } from "./equitableAssigners";

export type EquitableManualDraftAssignment = EquitableManualSlotAssignmentInput;

export type EquitableManualStudent = {
  userId: Id<"users">;
  displayName: string;
  rosterNumber?: number;
  firstName?: string;
  lastName?: string;
  image?: string;
  email?: string;
  genderBucket: EquitableManualGenderBucket;
  groupId?: Id<"groups">;
  groupName?: string;
};

export {
  assignmentsComplete,
  buildEquitableManualSlots,
  validateEquitableManualAssignments,
  type EquitableManualGenderBucket,
  type EquitableManualGroup,
  type EquitableManualSlot,
  type EquitableManualSlotAssignmentInput,
};

export function buildSlotsForRunOptions(args: {
  items: string[];
  scope: EquitableAssignerScope;
  balanceGender: boolean;
  groups: EquitableManualGroup[];
}): EquitableManualSlot[] {
  return buildEquitableManualSlots(args);
}

export function studentEligibleForSlot(
  student: EquitableManualStudent,
  slot: EquitableManualSlot,
  scope: EquitableAssignerScope,
): boolean {
  if (scope === "groups") {
    if (!slot.groupId || student.groupId !== slot.groupId) return false;
  }
  if (slot.genderRequired && student.genderBucket !== slot.genderRequired) return false;
  return true;
}

export function assignmentMap(
  assignments: EquitableManualDraftAssignment[],
): Map<string, Id<"users">> {
  return new Map(assignments.map((row) => [row.slotId, row.studentUserId]));
}

export function studentBySlot(
  assignments: EquitableManualDraftAssignment[],
): Map<Id<"users">, string> {
  return new Map(assignments.map((row) => [row.studentUserId, row.slotId]));
}

export function assignStudentToSlot(
  assignments: EquitableManualDraftAssignment[],
  slotId: string,
  studentUserId: Id<"users">,
): EquitableManualDraftAssignment[] {
  const withoutStudent = assignments.filter((row) => row.studentUserId !== studentUserId);
  const withoutSlot = withoutStudent.filter((row) => row.slotId !== slotId);
  return [...withoutSlot, { slotId, studentUserId }];
}

export function unassignSlot(
  assignments: EquitableManualDraftAssignment[],
  slotId: string,
): EquitableManualDraftAssignment[] {
  return assignments.filter((row) => row.slotId !== slotId);
}

export function unassignStudent(
  assignments: EquitableManualDraftAssignment[],
  studentUserId: Id<"users">,
): EquitableManualDraftAssignment[] {
  return assignments.filter((row) => row.studentUserId !== studentUserId);
}

export function assignmentsEqual(
  a: EquitableManualDraftAssignment[],
  b: EquitableManualDraftAssignment[],
): boolean {
  if (a.length !== b.length) return false;
  const mapB = assignmentMap(b);
  for (const row of a) {
    if (mapB.get(row.slotId) !== row.studentUserId) return false;
  }
  return true;
}

function shuffleInPlace<T>(items: T[], random: () => number): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const temp = items[i]!;
    items[i] = items[j]!;
    items[j] = temp;
  }
}

export function hasRandomAssignableRemaining(args: {
  slots: ReadonlyArray<EquitableManualSlot>;
  students: ReadonlyArray<EquitableManualStudent>;
  assignments: ReadonlyArray<EquitableManualDraftAssignment>;
  scope: EquitableAssignerScope;
}): boolean {
  const filled = assignmentMap([...args.assignments]);
  const assignedStudentIds = new Set(args.assignments.map((row) => row.studentUserId));
  const emptySlots = args.slots.filter((slot) => !filled.has(slot.id));
  const unassignedStudents = args.students.filter(
    (student) => !assignedStudentIds.has(student.userId),
  );

  for (const student of unassignedStudents) {
    for (const slot of emptySlots) {
      if (studentEligibleForSlot(student, slot, args.scope)) return true;
    }
  }
  return false;
}

export function randomAssignRemaining(args: {
  slots: ReadonlyArray<EquitableManualSlot>;
  students: ReadonlyArray<EquitableManualStudent>;
  assignments: ReadonlyArray<EquitableManualDraftAssignment>;
  scope: EquitableAssignerScope;
  random?: () => number;
}): EquitableManualDraftAssignment[] {
  const random = args.random ?? Math.random;
  const filled = assignmentMap([...args.assignments]);
  const assignedStudentIds = new Set(args.assignments.map((row) => row.studentUserId));
  const emptySlots = args.slots.filter((slot) => !filled.has(slot.id));
  const unassignedStudents = args.students.filter(
    (student) => !assignedStudentIds.has(student.userId),
  );

  const shuffledStudents = [...unassignedStudents];
  shuffleInPlace(shuffledStudents, random);

  const result = [...args.assignments];
  const filledSlotIds = new Set(filled.keys());

  for (const student of shuffledStudents) {
    const eligibleSlots = emptySlots.filter(
      (slot) => !filledSlotIds.has(slot.id) && studentEligibleForSlot(student, slot, args.scope),
    );
    if (eligibleSlots.length === 0) continue;

    const pickIndex = Math.floor(random() * eligibleSlots.length);
    const slot = eligibleSlots[pickIndex]!;
    result.push({ slotId: slot.id, studentUserId: student.userId });
    filledSlotIds.add(slot.id);
  }

  return result;
}
