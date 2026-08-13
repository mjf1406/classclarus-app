import type { Id } from "../../_generated/dataModel.js";
import { slotKey } from "./seatChartGeometry.js";
import type {
  LockedAssignment,
  SeatingAlgorithmInput,
  SeatingConstraint,
  SeatingDeskSlot,
  SeatingFailureEvidence,
  SeatingStudent,
} from "./types.js";

type StudentId = Id<"users">;

export type UnavailableStudentRole = "primary" | "other";

export function requiredStudentIds(constraints: ReadonlyArray<SeatingConstraint>): Set<StudentId> {
  const required = new Set<StudentId>();
  for (const constraint of constraints) {
    if (constraint.polarity !== "must") continue;
    required.add(constraint.studentUserId);
    if (constraint.otherStudentUserId) required.add(constraint.otherStudentUserId);
  }
  return required;
}

export function referencingConstraintsForStudent(
  studentUserId: StudentId,
  constraints: ReadonlyArray<SeatingConstraint>,
): Array<{
  constraintId: Id<"seatConstraints">;
  roles: UnavailableStudentRole[];
}> {
  const byId = new Map<Id<"seatConstraints">, UnavailableStudentRole[]>();
  for (const constraint of constraints) {
    if (constraint.polarity !== "must") continue;
    if (constraint.studentUserId === studentUserId) {
      const roles = byId.get(constraint.id) ?? [];
      roles.push("primary");
      byId.set(constraint.id, roles);
    }
    if (constraint.otherStudentUserId === studentUserId) {
      const roles = byId.get(constraint.id) ?? [];
      roles.push("other");
      byId.set(constraint.id, roles);
    }
  }
  return [...byId.entries()].map(([constraintId, roles]) => ({ constraintId, roles }));
}

export function buildUnavailableStudentsEvidence(
  studentIds: ReadonlyArray<StudentId>,
  constraints: ReadonlyArray<SeatingConstraint>,
): Extract<SeatingFailureEvidence, { kind: "unavailableStudents" }> {
  const unique = [...new Set(studentIds)];
  return {
    kind: "unavailableStudents",
    students: unique.map((studentUserId) => {
      const refs = referencingConstraintsForStudent(studentUserId, constraints);
      return {
        studentUserId,
        referencingConstraints: refs,
      };
    }),
  };
}

export function buildCapacityExceededEvidence(args: {
  input: SeatingAlgorithmInput;
  students: ReadonlyArray<SeatingStudent>;
  availableSlots: ReadonlyArray<SeatingDeskSlot>;
  lockedIds: ReadonlySet<StudentId>;
  constraints: ReadonlyArray<SeatingConstraint>;
}): Extract<SeatingFailureEvidence, { kind: "capacityExceeded" }> {
  const required = requiredStudentIds(args.constraints);
  const groups = new Set(args.students.map((student) => student.groupId));
  const result: Extract<SeatingFailureEvidence, { kind: "capacityExceeded" }> = {
    kind: "capacityExceeded",
    groups: [],
  };

  for (const groupId of groups) {
    const groupStudents = args.students.filter((student) => student.groupId === groupId);
    const capacity = args.availableSlots.filter((slot) => slot.groupId === groupId).length;
    const requiredStudents = groupStudents.filter((student) => required.has(student.studentUserId));
    if (requiredStudents.length <= capacity) continue;

    const contributingConstraintIds = new Set<Id<"seatConstraints">>();
    for (const constraint of args.constraints) {
      if (constraint.polarity !== "must") continue;
      const touches = requiredStudents.some(
        (student) =>
          student.studentUserId === constraint.studentUserId ||
          student.studentUserId === constraint.otherStudentUserId,
      );
      if (touches) contributingConstraintIds.add(constraint.id);
    }

    result.groups.push({
      groupId,
      availableSeats: capacity,
      requiredCount: requiredStudents.length,
      requiredStudentIds: requiredStudents.map((student) => student.studentUserId),
      contributingConstraintIds: [...contributingConstraintIds],
    });
  }

  return result;
}

function slotIdentity(slot: SeatingDeskSlot): string {
  return slotKey(slot.deskItemId, slot.groupId);
}

export function buildNoValidSeatEvidence(args: {
  input: SeatingAlgorithmInput;
  student: SeatingStudent;
  availableSlots: ReadonlyArray<SeatingDeskSlot>;
  constraints: ReadonlyArray<SeatingConstraint>;
  occupiedSlotKeys: ReadonlySet<string>;
}): Extract<SeatingFailureEvidence, { kind: "noValidSeat" }> {
  const groupSlots = args.availableSlots.filter((slot) => slot.groupId === args.student.groupId);
  let parityEliminated = 0;
  let zoneEliminated = 0;
  let occupiedEliminated = 0;
  let candidateSeatCount = 0;

  for (const slot of groupSlots) {
    if (args.occupiedSlotKeys.has(slotIdentity(slot))) {
      occupiedEliminated += 1;
      continue;
    }
    if (args.input.genderParityMode === "oddEven") {
      const odd = slot.deskNumber !== undefined && slot.deskNumber % 2 === 1;
      const bucket = args.student.genderBucket;
      if (bucket === "m" || bucket === "f") {
        const malesOnOdd = args.input.genderParityAssignment.malesOnOddDesks;
        const allowed = bucket === "m" ? odd === malesOnOdd : odd !== malesOnOdd;
        if (!allowed) {
          parityEliminated += 1;
          continue;
        }
      } else if (slot.deskNumber === undefined) {
        parityEliminated += 1;
        continue;
      }
    }
    const zoneOk = args.constraints.every((constraint) => {
      if (constraint.studentUserId !== args.student.studentUserId || constraint.type !== "zone") {
        return true;
      }
      const matches = (slot.zoneName ?? "") === (constraint.zoneName?.trim() ?? "");
      return constraint.polarity === "must" ? matches : !matches;
    });
    if (!zoneOk) {
      zoneEliminated += 1;
      continue;
    }
    candidateSeatCount += 1;
  }

  return {
    kind: "noValidSeat",
    students: [
      {
        studentUserId: args.student.studentUserId,
        groupId: args.student.groupId,
        candidateSeatCount,
        groupSlotCount: groupSlots.length,
        parityEliminated,
        zoneEliminated,
        occupiedEliminated,
      },
    ],
  };
}

export function buildParityCapacityExceededEvidence(args: {
  students: ReadonlyArray<SeatingStudent>;
  availableSlots: ReadonlyArray<SeatingDeskSlot>;
  malesOnOddDesks: boolean;
}): Extract<SeatingFailureEvidence, { kind: "parityCapacityExceeded" }> | null {
  const groups = new Set(args.students.map((student) => student.groupId));
  const result: Extract<SeatingFailureEvidence, { kind: "parityCapacityExceeded" }> = {
    kind: "parityCapacityExceeded",
    groups: [],
    malesOnOddDesks: args.malesOnOddDesks,
  };

  for (const groupId of groups) {
    const groupStudents = args.students.filter((student) => student.groupId === groupId);
    const groupSlots = args.availableSlots.filter((slot) => slot.groupId === groupId);
    const maleCount = groupStudents.filter((student) => student.genderBucket === "m").length;
    const femaleCount = groupStudents.filter((student) => student.genderBucket === "f").length;
    const oddSeats = groupSlots.filter(
      (slot) => slot.deskNumber !== undefined && slot.deskNumber % 2 === 1,
    ).length;
    const evenSeats = groupSlots.filter(
      (slot) => slot.deskNumber !== undefined && slot.deskNumber % 2 === 0,
    ).length;
    const maleSeatCount = args.malesOnOddDesks ? oddSeats : evenSeats;
    const femaleSeatCount = args.malesOnOddDesks ? evenSeats : oddSeats;
    if (maleCount <= maleSeatCount && femaleCount <= femaleSeatCount) continue;

    result.groups.push({
      groupId,
      maleCount,
      femaleCount,
      maleSeatCount,
      femaleSeatCount,
      affectedStudentIds: groupStudents
        .filter((student) => student.genderBucket === "m" || student.genderBucket === "f")
        .map((student) => student.studentUserId),
    });
  }

  return result.groups.length > 0 ? result : null;
}

export function lockedAssignmentEvidence(
  locked: LockedAssignment,
  deskNumber?: number,
  zoneName?: string,
): {
  studentUserId: Id<"users">;
  deskItemId: string;
  groupId: Id<"groups">;
  deskNumber?: number;
  zoneName?: string;
} {
  return {
    studentUserId: locked.studentUserId,
    deskItemId: locked.deskItemId,
    groupId: locked.groupId,
    ...(deskNumber !== undefined ? { deskNumber } : {}),
    ...(zoneName?.trim() ? { zoneName: zoneName.trim() } : {}),
  };
}

export function buildSearchExhaustedEvidence(
  input: SeatingAlgorithmInput,
): Extract<SeatingFailureEvidence, { kind: "searchExhausted" }> {
  return {
    kind: "searchExhausted",
    movableStudentCount: input.students.length,
    constraintCount: input.constraints.length,
    lockedCount: input.locked.length,
    slotCount: input.slots.length,
    genderParityMode: input.genderParityMode,
  };
}

export function collectUnavailableStudentsFromInput(
  input: SeatingAlgorithmInput,
): Extract<SeatingFailureEvidence, { kind: "unavailableStudents" }> | undefined {
  const required = requiredStudentIds(input.constraints);
  const poolIds = new Set(input.students.map((student) => student.studentUserId));
  const lockedIds = new Set(input.locked.map((row) => row.studentUserId));
  const missing = [...required].filter((id) => !lockedIds.has(id) && !poolIds.has(id));
  if (missing.length === 0) return undefined;
  return buildUnavailableStudentsEvidence(missing, input.constraints);
}

export function affectedStudentIdsFromEvidence(
  evidence: SeatingFailureEvidence | undefined,
): Array<Id<"users">> {
  if (!evidence) return [];
  switch (evidence.kind) {
    case "unavailableStudents":
      return evidence.students.map((student) => student.studentUserId);
    case "capacityExceeded":
      return evidence.groups.flatMap((group) => group.requiredStudentIds);
    case "noValidSeat":
      return evidence.students.map((student) => student.studentUserId);
    case "unavailableSeat":
    case "parityLockedConflict":
    case "manualConstraintConflict":
      return evidence.locks.map((lock) => lock.studentUserId);
    case "duplicateManual":
      return evidence.duplicateStudentIds;
    case "constraintParityConflict":
      return evidence.affectedStudentIds;
    case "parityCapacityExceeded":
      return evidence.groups.flatMap((group) => group.affectedStudentIds);
    case "searchExhausted":
      return [];
    default:
      return [];
  }
}
