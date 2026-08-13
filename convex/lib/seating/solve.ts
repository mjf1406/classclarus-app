import type { Id } from "../../_generated/dataModel.js";
import { slotKey, type ChartAssignment } from "./seatChartGeometry.js";
import { seatHistoryKey } from "./historyKeys.js";
import {
  buildCapacityExceededEvidence,
  buildNoValidSeatEvidence,
  buildParityCapacityExceededEvidence,
  buildSearchExhaustedEvidence,
  buildUnavailableStudentsEvidence,
  lockedAssignmentEvidence,
} from "./failureEvidence.js";
import { constraintSatisfied, parityAllows } from "./predicates.js";
import type {
  SeatingAlgorithmInput,
  SeatingAlgorithmResult,
  SeatingConstraint,
  SeatingDeskSlot,
  SeatingFailureEvidence,
  SeatingStudent,
} from "./types.js";

type StudentId = Id<"users">;
type AssignmentMap = Map<StudentId, SeatingDeskSlot>;

type FairnessState = {
  seat: Map<StudentId, number>;
  zone: Map<StudentId, number | null>;
  team: Map<StudentId, number | null>;
  neighbor: Map<string, number>;
  degree: Map<StudentId, number>;
};

type Candidate = {
  assignmentByStudent: AssignmentMap;
  fairnessVector: number[];
  tieKey: number;
  fairnessState: FairnessState;
};

const EXACT_STUDENT_LIMIT = 7;
const EXACT_NODE_LIMIT = 2_000_000;
const LARGE_SEARCH_NODE_LIMIT = 50_000;

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function seededRandom(seed: string): () => number {
  let state = hashString(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function compareNumbers(left: readonly number[], right: readonly number[]): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function slotIdentity(slot: SeatingDeskSlot): string {
  return slotKey(slot.deskItemId, slot.groupId);
}

function sortedSlots(slots: ReadonlyArray<SeatingDeskSlot>): SeatingDeskSlot[] {
  return [...slots].sort(
    (left, right) =>
      String(left.groupId).localeCompare(String(right.groupId)) ||
      (left.deskNumber ?? Number.MAX_SAFE_INTEGER) -
        (right.deskNumber ?? Number.MAX_SAFE_INTEGER) ||
      left.deskItemId.localeCompare(right.deskItemId),
  );
}

function relevantConstraints(input: SeatingAlgorithmInput): SeatingConstraint[] {
  return [...input.constraints].sort((left, right) =>
    String(left.id).localeCompare(String(right.id)),
  );
}

function constraintsSatisfied(
  constraints: ReadonlyArray<SeatingConstraint>,
  assignmentByStudent: AssignmentMap,
): boolean {
  return constraints.every((constraint) => constraintSatisfied(constraint, assignmentByStudent));
}

function partialConstraintsSatisfied(
  constraints: ReadonlyArray<SeatingConstraint>,
  assignmentByStudent: AssignmentMap,
  assignedStudentId: StudentId,
): boolean {
  return constraints.every((constraint) => {
    if (
      constraint.studentUserId !== assignedStudentId &&
      constraint.otherStudentUserId !== assignedStudentId
    ) {
      return true;
    }
    const primaryAssigned = assignmentByStudent.has(constraint.studentUserId);
    const otherAssigned =
      constraint.type === "zone" ||
      (constraint.otherStudentUserId !== undefined &&
        assignmentByStudent.has(constraint.otherStudentUserId));
    if (!primaryAssigned || !otherAssigned) return true;
    return constraintSatisfied(constraint, assignmentByStudent);
  });
}

function metric(values: readonly number[], missingCount: number): number[] {
  if (values.length === 0) return [missingCount, 0, 0, 0];
  return [
    missingCount,
    Math.max(...values),
    values.reduce((sum, value) => sum + value, 0),
    values.reduce((sum, value) => sum + value * value, 0),
  ];
}

function occupantFrom(assignmentByStudent: AssignmentMap): Map<string, StudentId> {
  const occupant = new Map<string, StudentId>();
  for (const [studentId, slot] of assignmentByStudent) {
    occupant.set(slotIdentity(slot), studentId);
  }
  return occupant;
}

/** Bidirectional desk adjacency matching `areNeighbors`. */
function neighborDeskIndex(slots: ReadonlyArray<SeatingDeskSlot>): Map<string, string[]> {
  const sets = new Map<string, Set<string>>();
  const add = (from: string, to: string) => {
    if (from === to) return;
    const current = sets.get(from) ?? new Set<string>();
    current.add(to);
    sets.set(from, current);
  };
  for (const slot of slots) {
    for (const neighborId of slot.neighborDeskIds) {
      add(slot.deskItemId, neighborId);
      add(neighborId, slot.deskItemId);
    }
  }
  return new Map([...sets.entries()].map(([deskItemId, ids]) => [deskItemId, [...ids]]));
}

function fairnessVector(
  input: SeatingAlgorithmInput,
  assignmentByStudent: AssignmentMap,
  occupant = occupantFrom(assignmentByStudent),
  deskNeighbors = neighborDeskIndex(input.slots),
): number[] {
  const neighborCounts: number[] = [];
  const seatCounts: number[] = [];
  const zoneCounts: number[] = [];
  const teamCounts: number[] = [];
  let studentsWithoutNeighbor = 0;
  let studentsWithoutZone = 0;
  let studentsWithoutTeam = 0;

  for (const [studentId, slot] of assignmentByStudent) {
    const history = input.history.byStudent.get(studentId);
    seatCounts.push(history?.seat.get(seatHistoryKey(input.layoutId, slot.deskItemId)) ?? 0);
    if (slot.zoneName) {
      zoneCounts.push(history?.zone.get(slot.zoneName) ?? 0);
    } else {
      studentsWithoutZone += 1;
    }
    if (slot.teamKey) {
      teamCounts.push(history?.team.get(slot.teamKey) ?? 0);
    } else {
      studentsWithoutTeam += 1;
    }

    let neighborCount = 0;
    const neighborDesks = deskNeighbors.get(slot.deskItemId) ?? slot.neighborDeskIds;
    for (const neighborDeskId of neighborDesks) {
      const otherId = occupant.get(slotKey(neighborDeskId, slot.groupId));
      if (!otherId || otherId === studentId) continue;
      const otherSlot = assignmentByStudent.get(otherId);
      if (!otherSlot || otherSlot.groupId !== slot.groupId) continue;
      neighborCount += 1;
      neighborCounts.push(history?.neighbor.get(otherId) ?? 0);
    }
    if (neighborCount === 0) studentsWithoutNeighbor += 1;
  }

  return [
    ...metric(neighborCounts, studentsWithoutNeighbor),
    ...metric(seatCounts, 0),
    ...metric(zoneCounts, studentsWithoutZone),
    ...metric(teamCounts, studentsWithoutTeam),
  ];
}

function directedNeighborKey(from: StudentId, to: StudentId): string {
  return `${from}\0${to}`;
}

function visitNeighbors(
  studentId: StudentId,
  slot: SeatingDeskSlot,
  assignmentByStudent: AssignmentMap,
  occupant: Map<string, StudentId>,
  deskNeighbors: Map<string, string[]>,
  visit: (otherId: StudentId) => void,
): void {
  const neighborDesks = deskNeighbors.get(slot.deskItemId) ?? slot.neighborDeskIds;
  for (const neighborDeskId of neighborDesks) {
    const otherId = occupant.get(slotKey(neighborDeskId, slot.groupId));
    if (!otherId || otherId === studentId) continue;
    const otherSlot = assignmentByStudent.get(otherId);
    if (!otherSlot || otherSlot.groupId !== slot.groupId) continue;
    visit(otherId);
  }
}

function historySeatCount(
  input: SeatingAlgorithmInput,
  studentId: StudentId,
  slot: SeatingDeskSlot,
): number {
  return (
    input.history.byStudent
      .get(studentId)
      ?.seat.get(seatHistoryKey(input.layoutId, slot.deskItemId)) ?? 0
  );
}

function setSeatZoneTeam(
  state: FairnessState,
  input: SeatingAlgorithmInput,
  studentId: StudentId,
  slot: SeatingDeskSlot,
): void {
  const history = input.history.byStudent.get(studentId);
  state.seat.set(studentId, historySeatCount(input, studentId, slot));
  state.zone.set(studentId, slot.zoneName ? (history?.zone.get(slot.zoneName) ?? 0) : null);
  state.team.set(studentId, slot.teamKey ? (history?.team.get(slot.teamKey) ?? 0) : null);
}

function stripIncidentNeighbors(
  state: FairnessState,
  studentId: StudentId,
  slot: SeatingDeskSlot,
  assignmentByStudent: AssignmentMap,
  occupant: Map<string, StudentId>,
  deskNeighbors: Map<string, string[]>,
): void {
  visitNeighbors(studentId, slot, assignmentByStudent, occupant, deskNeighbors, (otherId) => {
    if (state.neighbor.delete(directedNeighborKey(studentId, otherId))) {
      state.degree.set(studentId, (state.degree.get(studentId) ?? 1) - 1);
    }
    if (state.neighbor.delete(directedNeighborKey(otherId, studentId))) {
      state.degree.set(otherId, (state.degree.get(otherId) ?? 1) - 1);
    }
  });
}

function addIncidentNeighbors(
  state: FairnessState,
  input: SeatingAlgorithmInput,
  studentId: StudentId,
  slot: SeatingDeskSlot,
  assignmentByStudent: AssignmentMap,
  occupant: Map<string, StudentId>,
  deskNeighbors: Map<string, string[]>,
): void {
  const history = input.history.byStudent.get(studentId);
  visitNeighbors(studentId, slot, assignmentByStudent, occupant, deskNeighbors, (otherId) => {
    const forward = directedNeighborKey(studentId, otherId);
    if (!state.neighbor.has(forward)) {
      state.neighbor.set(forward, history?.neighbor.get(otherId) ?? 0);
      state.degree.set(studentId, (state.degree.get(studentId) ?? 0) + 1);
    }
    const backward = directedNeighborKey(otherId, studentId);
    if (!state.neighbor.has(backward)) {
      state.neighbor.set(
        backward,
        input.history.byStudent.get(otherId)?.neighbor.get(studentId) ?? 0,
      );
      state.degree.set(otherId, (state.degree.get(otherId) ?? 0) + 1);
    }
  });
}

function cloneFairnessState(state: FairnessState): FairnessState {
  return {
    seat: new Map(state.seat),
    zone: new Map(state.zone),
    team: new Map(state.team),
    neighbor: new Map(state.neighbor),
    degree: new Map(state.degree),
  };
}

function vectorFromFairnessState(state: FairnessState, assigned: AssignmentMap): number[] {
  const zoneCounts: number[] = [];
  const teamCounts: number[] = [];
  let studentsWithoutZone = 0;
  let studentsWithoutTeam = 0;
  let studentsWithoutNeighbor = 0;
  for (const studentId of assigned.keys()) {
    const zone = state.zone.get(studentId);
    if (zone === null || zone === undefined) studentsWithoutZone += 1;
    else zoneCounts.push(zone);
    const team = state.team.get(studentId);
    if (team === null || team === undefined) studentsWithoutTeam += 1;
    else teamCounts.push(team);
    if ((state.degree.get(studentId) ?? 0) <= 0) studentsWithoutNeighbor += 1;
  }
  return [
    ...metric([...state.neighbor.values()], studentsWithoutNeighbor),
    ...metric([...state.seat.values()], 0),
    ...metric(zoneCounts, studentsWithoutZone),
    ...metric(teamCounts, studentsWithoutTeam),
  ];
}

function fairnessStateFrom(
  input: SeatingAlgorithmInput,
  assignmentByStudent: AssignmentMap,
  occupant: Map<string, StudentId>,
  deskNeighbors: Map<string, string[]>,
): FairnessState {
  const state: FairnessState = {
    seat: new Map(),
    zone: new Map(),
    team: new Map(),
    neighbor: new Map(),
    degree: new Map(),
  };
  for (const [studentId, slot] of assignmentByStudent) {
    setSeatZoneTeam(state, input, studentId, slot);
    state.degree.set(studentId, 0);
  }
  for (const [studentId, slot] of assignmentByStudent) {
    addIncidentNeighbors(
      state,
      input,
      studentId,
      slot,
      assignmentByStudent,
      occupant,
      deskNeighbors,
    );
  }
  return state;
}

function assignmentSignature(assignmentByStudent: AssignmentMap): string {
  return [...assignmentByStudent]
    .sort(([left], [right]) => String(left).localeCompare(String(right)))
    .map(([studentId, slot]) => `${studentId}:${slotIdentity(slot)}`)
    .join("|");
}

/** Exposes the solver's ordered objective for diagnostics and differential tests. */
export function evaluateSeatingFairness(
  input: SeatingAlgorithmInput,
  assignments: ReadonlyArray<ChartAssignment>,
): number[] {
  const slotByKey = new Map(input.slots.map((slot) => [slotIdentity(slot), slot]));
  const assignmentByStudent: AssignmentMap = new Map();
  for (const assignment of assignments) {
    const slot = slotByKey.get(slotKey(assignment.deskItemId, assignment.groupId));
    if (slot) assignmentByStudent.set(assignment.studentUserId, slot);
  }
  return fairnessVector(input, assignmentByStudent);
}

function candidateFrom(
  input: SeatingAlgorithmInput,
  assignmentByStudent: AssignmentMap,
  occupant = occupantFrom(assignmentByStudent),
  deskNeighbors = neighborDeskIndex(input.slots),
): Candidate {
  const fairnessState = fairnessStateFrom(input, assignmentByStudent, occupant, deskNeighbors);
  return {
    assignmentByStudent: new Map(assignmentByStudent),
    fairnessVector: vectorFromFairnessState(fairnessState, assignmentByStudent),
    tieKey: hashString(`${input.randomSeed}:${assignmentSignature(assignmentByStudent)}`),
    fairnessState,
  };
}

function betterCandidate(candidate: Candidate, current: Candidate | undefined): boolean {
  if (!current) return true;
  const comparison = compareNumbers(candidate.fairnessVector, current.fairnessVector);
  return comparison < 0 || (comparison === 0 && candidate.tieKey < current.tieKey);
}

function unaryDomainAllows(
  input: SeatingAlgorithmInput,
  student: SeatingStudent,
  slot: SeatingDeskSlot,
  constraints: ReadonlyArray<SeatingConstraint>,
): boolean {
  if (
    slot.groupId !== student.groupId ||
    !parityAllows(input.genderParityMode, input.genderParityAssignment, student, slot)
  ) {
    return false;
  }
  return constraints.every((constraint) => {
    if (constraint.studentUserId !== student.studentUserId || constraint.type !== "zone") {
      return true;
    }
    const matches = (slot.zoneName ?? "") === (constraint.zoneName?.trim() ?? "");
    return constraint.polarity === "must" ? matches : !matches;
  });
}

function seatTotal(input: SeatingAlgorithmInput, studentId: StudentId): number {
  const history = input.history.byStudent.get(studentId);
  if (!history) return 0;
  let total = 0;
  for (const count of history.seat.values()) total += count;
  return total;
}

function selectStudents(args: {
  input: SeatingAlgorithmInput;
  students: SeatingStudent[];
  availableSlots: SeatingDeskSlot[];
  lockedIds: ReadonlySet<StudentId>;
  constraints: SeatingConstraint[];
}):
  | { selected: SeatingStudent[]; unseated: StudentId[] }
  | {
      error: string;
      evidence: SeatingFailureEvidence;
      unseatedStudentIds: StudentId[];
    } {
  const required = new Set<StudentId>();
  for (const constraint of args.constraints) {
    if (constraint.polarity !== "must") continue;
    required.add(constraint.studentUserId);
    if (constraint.otherStudentUserId) required.add(constraint.otherStudentUserId);
  }

  const selected: SeatingStudent[] = [];
  const unseated: StudentId[] = [];
  const groups = new Set(args.students.map((student) => student.groupId));
  for (const groupId of groups) {
    const groupStudents = args.students.filter((student) => student.groupId === groupId);
    const capacity = args.availableSlots.filter((slot) => slot.groupId === groupId).length;
    const requiredStudents = groupStudents.filter((student) => required.has(student.studentUserId));
    if (requiredStudents.length > capacity) {
      const evidence = buildCapacityExceededEvidence({
        input: args.input,
        students: args.students,
        availableSlots: args.availableSlots,
        lockedIds: args.lockedIds,
        constraints: args.constraints,
      });
      return {
        error: "Required seating constraints exceed the available seats.",
        evidence,
        unseatedStudentIds: requiredStudents.map((student) => student.studentUserId),
      };
    }
    const optional = groupStudents
      .filter((student) => !required.has(student.studentUserId))
      .sort(
        (left, right) =>
          seatTotal(args.input, left.studentUserId) - seatTotal(args.input, right.studentUserId) ||
          hashString(`${args.input.randomSeed}:${left.studentUserId}`) -
            hashString(`${args.input.randomSeed}:${right.studentUserId}`),
      );
    const chosen = [
      ...requiredStudents.sort((left, right) =>
        String(left.studentUserId).localeCompare(String(right.studentUserId)),
      ),
      ...optional.slice(0, Math.max(0, capacity - requiredStudents.length)),
    ];
    const chosenIds = new Set(chosen.map((student) => student.studentUserId));
    selected.push(...chosen);
    unseated.push(
      ...groupStudents
        .filter((student) => !chosenIds.has(student.studentUserId))
        .map((student) => student.studentUserId),
    );
  }

  const missingRequired: StudentId[] = [];
  for (const requiredId of required) {
    if (
      !args.lockedIds.has(requiredId) &&
      !selected.some((student) => student.studentUserId === requiredId)
    ) {
      missingRequired.push(requiredId);
    }
  }
  if (missingRequired.length > 0) {
    return {
      error: "A required seating constraint references an unavailable student.",
      evidence: buildUnavailableStudentsEvidence(missingRequired, args.constraints),
      unseatedStudentIds: missingRequired,
    };
  }
  return { selected, unseated };
}

function searchAssignments(args: {
  input: SeatingAlgorithmInput;
  selected: SeatingStudent[];
  domains: Map<StudentId, SeatingDeskSlot[]>;
  baseAssignments: AssignmentMap;
  constraints: SeatingConstraint[];
  exact: boolean;
  random: () => number;
  deskNeighbors: Map<string, string[]>;
}): { best?: Candidate; exhausted: boolean } {
  const assignmentByStudent = new Map(args.baseAssignments);
  const occupied = new Set([...args.baseAssignments.values()].map(slotIdentity));
  let best: Candidate | undefined;
  let nodes = 0;
  let exhausted = true;
  const nodeLimit = args.exact ? EXACT_NODE_LIMIT : LARGE_SEARCH_NODE_LIMIT;

  const recurse = (remaining: SeatingStudent[]): boolean => {
    nodes += 1;
    if (nodes > nodeLimit) {
      exhausted = false;
      return false;
    }
    if (remaining.length === 0) {
      if (!constraintsSatisfied(args.constraints, assignmentByStudent)) return false;
      const candidate = candidateFrom(
        args.input,
        assignmentByStudent,
        occupantFrom(assignmentByStudent),
        args.deskNeighbors,
      );
      if (betterCandidate(candidate, best)) best = candidate;
      return !args.exact;
    }

    const optionsByStudent = remaining.map((student) => ({
      student,
      options: (args.domains.get(student.studentUserId) ?? []).filter(
        (slot) => !occupied.has(slotIdentity(slot)),
      ),
    }));
    optionsByStudent.sort(
      (left, right) =>
        left.options.length - right.options.length ||
        String(left.student.studentUserId).localeCompare(String(right.student.studentUserId)),
    );
    const { student, options } = optionsByStudent[0]!;
    const nextRemaining = remaining.filter(
      (candidate) => candidate.studentUserId !== student.studentUserId,
    );
    const orderedOptions = options
      .map((slot) => ({ slot, tie: args.random() }))
      .sort((left, right) => left.tie - right.tie)
      .map(({ slot }) => slot);

    for (const slot of orderedOptions) {
      assignmentByStudent.set(student.studentUserId, slot);
      occupied.add(slotIdentity(slot));
      if (
        partialConstraintsSatisfied(args.constraints, assignmentByStudent, student.studentUserId)
      ) {
        const stop = recurse(nextRemaining);
        if (stop && !args.exact) return true;
      }
      assignmentByStudent.delete(student.studentUserId);
      occupied.delete(slotIdentity(slot));
    }
    return false;
  };

  recurse(args.selected);
  return { best, exhausted };
}

function improveCandidate(args: {
  input: SeatingAlgorithmInput;
  candidate: Candidate;
  selected: SeatingStudent[];
  domains: Map<StudentId, SeatingDeskSlot[]>;
  constraints: SeatingConstraint[];
  availableSlots: SeatingDeskSlot[];
  random: () => number;
}): Candidate {
  let best = args.candidate;
  const selectedIds = new Set(args.selected.map((student) => student.studentUserId));
  const movableIds = [...selectedIds];
  const operations: Array<
    | { kind: "swap"; left: StudentId; right: StudentId }
    | { kind: "move"; studentId: StudentId; slot: SeatingDeskSlot }
  > = [];
  for (let leftIndex = 0; leftIndex < movableIds.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < movableIds.length; rightIndex += 1) {
      const left = movableIds[leftIndex]!;
      const right = movableIds[rightIndex]!;
      if (
        best.assignmentByStudent.get(left)?.groupId === best.assignmentByStudent.get(right)?.groupId
      ) {
        operations.push({ kind: "swap", left, right });
      }
    }
  }
  const occupied = new Set([...best.assignmentByStudent.values()].map(slotIdentity));
  for (const studentId of movableIds) {
    for (const slot of args.domains.get(studentId) ?? []) {
      if (!occupied.has(slotIdentity(slot))) {
        operations.push({ kind: "move", studentId, slot });
      }
    }
  }

  const deskNeighbors = neighborDeskIndex(args.input.slots);
  const domainSlotKeys = new Map<StudentId, Set<string>>();
  for (const [studentId, domain] of args.domains) {
    domainSlotKeys.set(studentId, new Set(domain.map(slotIdentity)));
  }
  let bestOccupant = occupantFrom(best.assignmentByStudent);
  let bestState = cloneFairnessState(best.fairnessState);

  const randomizedOperations = operations
    .map((operation) => ({ operation, tie: args.random() }))
    .sort((left, right) => left.tie - right.tie)
    .map(({ operation }) => operation);
  const trialLimit = Math.min(2_500, randomizedOperations.length);
  for (let index = 0; index < trialLimit; index += 1) {
    const operation = randomizedOperations[index]!;
    const trial = new Map(best.assignmentByStudent);
    const occupant = new Map(bestOccupant);
    const previousLeft = operation.kind === "swap" ? trial.get(operation.left) : undefined;
    const previousRight = operation.kind === "swap" ? trial.get(operation.right) : undefined;
    const previousMoved = operation.kind === "move" ? trial.get(operation.studentId) : undefined;
    if (operation.kind === "swap") {
      const leftSlot = previousLeft;
      const rightSlot = previousRight;
      if (!leftSlot || !rightSlot) continue;
      if (
        !domainSlotKeys.get(operation.left)?.has(slotIdentity(rightSlot)) ||
        !domainSlotKeys.get(operation.right)?.has(slotIdentity(leftSlot))
      ) {
        continue;
      }
      trial.set(operation.left, rightSlot);
      trial.set(operation.right, leftSlot);
      occupant.set(slotIdentity(rightSlot), operation.left);
      occupant.set(slotIdentity(leftSlot), operation.right);
    } else {
      if (!previousMoved) continue;
      if (occupant.has(slotIdentity(operation.slot))) continue;
      trial.set(operation.studentId, operation.slot);
      occupant.delete(slotIdentity(previousMoved));
      occupant.set(slotIdentity(operation.slot), operation.studentId);
    }
    if (!constraintsSatisfied(args.constraints, trial)) continue;

    const nextState = cloneFairnessState(bestState);
    if (operation.kind === "swap" && previousLeft && previousRight) {
      stripIncidentNeighbors(
        nextState,
        operation.left,
        previousLeft,
        best.assignmentByStudent,
        bestOccupant,
        deskNeighbors,
      );
      stripIncidentNeighbors(
        nextState,
        operation.right,
        previousRight,
        best.assignmentByStudent,
        bestOccupant,
        deskNeighbors,
      );
      setSeatZoneTeam(nextState, args.input, operation.left, previousRight);
      setSeatZoneTeam(nextState, args.input, operation.right, previousLeft);
      addIncidentNeighbors(
        nextState,
        args.input,
        operation.left,
        previousRight,
        trial,
        occupant,
        deskNeighbors,
      );
      addIncidentNeighbors(
        nextState,
        args.input,
        operation.right,
        previousLeft,
        trial,
        occupant,
        deskNeighbors,
      );
    } else if (operation.kind === "move" && previousMoved) {
      stripIncidentNeighbors(
        nextState,
        operation.studentId,
        previousMoved,
        best.assignmentByStudent,
        bestOccupant,
        deskNeighbors,
      );
      setSeatZoneTeam(nextState, args.input, operation.studentId, operation.slot);
      addIncidentNeighbors(
        nextState,
        args.input,
        operation.studentId,
        operation.slot,
        trial,
        occupant,
        deskNeighbors,
      );
    }

    const candidate: Candidate = {
      assignmentByStudent: trial,
      fairnessState: nextState,
      fairnessVector: vectorFromFairnessState(nextState, trial),
      tieKey: hashString(`${args.input.randomSeed}:${assignmentSignature(trial)}`),
    };
    if (betterCandidate(candidate, best)) {
      best = candidate;
      bestOccupant = occupant;
      bestState = nextState;
    }
  }
  return best;
}

function assignmentsFromCandidate(
  candidate: Candidate,
  movableIds: ReadonlySet<StudentId>,
): ChartAssignment[] {
  return [...candidate.assignmentByStudent]
    .filter(([studentId]) => movableIds.has(studentId))
    .map(([studentUserId, slot]) => ({
      deskItemId: slot.deskItemId,
      groupId: slot.groupId,
      studentUserId,
    }))
    .sort(
      (left, right) =>
        String(left.groupId).localeCompare(String(right.groupId)) ||
        left.deskItemId.localeCompare(right.deskItemId),
    );
}

/** Deterministic client-side hard-constraint solver with lexicographic fairness. */
export function solveSeating(input: SeatingAlgorithmInput): SeatingAlgorithmResult {
  const slots = sortedSlots(input.slots);
  const slotByKey = new Map(slots.map((slot) => [slotIdentity(slot), slot]));
  const studentById = new Map(input.students.map((student) => [student.studentUserId, student]));
  const baseAssignments: AssignmentMap = new Map();
  const lockedIds = new Set<StudentId>();
  const lockedSlotKeys = new Set<string>();

  for (const locked of input.locked) {
    const slot = slotByKey.get(slotKey(locked.deskItemId, locked.groupId));
    if (!slot) {
      const lockEvidence = lockedAssignmentEvidence(locked);
      return {
        status: "infeasible",
        code: "SEATING_INFEASIBLE",
        message: "A manually seated student references an unavailable seat.",
        unseatedStudentIds: [locked.studentUserId],
        evidence: {
          kind: "unavailableSeat",
          locks: [lockEvidence],
        },
      };
    }
    if (lockedIds.has(locked.studentUserId) || lockedSlotKeys.has(slotIdentity(slot))) {
      const duplicateStudentIds = lockedIds.has(locked.studentUserId) ? [locked.studentUserId] : [];
      const duplicateDeskKeys = lockedSlotKeys.has(slotIdentity(slot)) ? [slotIdentity(slot)] : [];
      return {
        status: "infeasible",
        code: "SEATING_INFEASIBLE",
        message: "Manual seating contains a duplicate student or seat.",
        unseatedStudentIds: duplicateStudentIds,
        evidence: {
          kind: "duplicateManual",
          duplicateStudentIds,
          duplicateDeskKeys,
        },
      };
    }
    const student = studentById.get(locked.studentUserId);
    if (
      student &&
      !parityAllows(input.genderParityMode, input.genderParityAssignment, student, slot)
    ) {
      const lockEvidence = lockedAssignmentEvidence(locked, slot.deskNumber, slot.zoneName);
      return {
        status: "infeasible",
        code: "SEATING_INFEASIBLE",
        message: "A manually seated student conflicts with odd/even gender parity.",
        unseatedStudentIds: [locked.studentUserId],
        evidence: {
          kind: "parityLockedConflict",
          locks: [lockEvidence],
          malesOnOddDesks: input.genderParityAssignment.malesOnOddDesks,
        },
      };
    }
    lockedIds.add(locked.studentUserId);
    lockedSlotKeys.add(slotIdentity(slot));
    baseAssignments.set(locked.studentUserId, slot);
  }

  const movableStudents = input.students.filter((student) => !lockedIds.has(student.studentUserId));
  const constraints = relevantConstraints(input);
  const occupiedLockedSlots = new Set([...baseAssignments.values()].map(slotIdentity));
  const availableSlots = slots.filter((slot) => !occupiedLockedSlots.has(slotIdentity(slot)));
  const selection = selectStudents({
    input,
    students: [...movableStudents].sort((left, right) =>
      String(left.studentUserId).localeCompare(String(right.studentUserId)),
    ),
    availableSlots,
    lockedIds,
    constraints,
  });
  if ("error" in selection) {
    return {
      status: "infeasible",
      code: "SEATING_INFEASIBLE",
      message: selection.error,
      unseatedStudentIds: selection.unseatedStudentIds,
      evidence: selection.evidence,
    };
  }

  if (input.genderParityMode === "oddEven") {
    const parityCapacity = buildParityCapacityExceededEvidence({
      students: selection.selected,
      availableSlots,
      malesOnOddDesks: input.genderParityAssignment.malesOnOddDesks,
    });
    if (parityCapacity) {
      return {
        status: "infeasible",
        code: "SEATING_INFEASIBLE",
        message: "Odd/even gender parity does not have enough matching desks.",
        unseatedStudentIds: [
          ...parityCapacity.groups.flatMap((group) => group.affectedStudentIds),
          ...selection.unseated,
        ],
        evidence: parityCapacity,
      };
    }
  }

  const selectedIds = new Set(selection.selected.map((student) => student.studentUserId));
  const domains = new Map<StudentId, SeatingDeskSlot[]>();
  for (const student of selection.selected) {
    const domain = availableSlots.filter((slot) =>
      unaryDomainAllows(input, student, slot, constraints),
    );
    if (domain.length === 0) {
      const evidence = buildNoValidSeatEvidence({
        input,
        student,
        availableSlots,
        constraints,
        occupiedSlotKeys: occupiedLockedSlots,
      });
      return {
        status: "infeasible",
        code: "SEATING_INFEASIBLE",
        message: "No valid seat is available for at least one student.",
        unseatedStudentIds: [student.studentUserId],
        evidence,
      };
    }
    domains.set(student.studentUserId, domain);
  }

  if (selection.selected.length === 0) {
    if (!constraintsSatisfied(constraints, baseAssignments)) {
      const conflictingConstraintIds = constraints
        .filter((constraint) => !constraintSatisfied(constraint, baseAssignments))
        .map((constraint) => constraint.id);
      const locks = input.locked.map((row) => {
        const slot = slotByKey.get(slotKey(row.deskItemId, row.groupId));
        return lockedAssignmentEvidence(row, slot?.deskNumber, slot?.zoneName);
      });
      return {
        status: "infeasible",
        code: "SEATING_INFEASIBLE",
        message: "The manual seating conflicts with a required seating constraint.",
        unseatedStudentIds: selection.unseated,
        evidence: {
          kind: "manualConstraintConflict",
          locks,
          conflictingConstraintIds,
        },
      };
    }
    return {
      status: "ok",
      assignments: [],
      meta: {
        unseatedStudentIds: selection.unseated,
        fairnessVector: fairnessVector(input, baseAssignments),
        violationCount: 0,
      },
    };
  }

  const exact =
    selection.selected.length <= EXACT_STUDENT_LIMIT &&
    Math.max(...[...domains.values()].map((domain) => domain.length)) <= 8;
  const deskNeighbors = neighborDeskIndex(input.slots);
  const random = seededRandom(input.randomSeed);
  const restarts = exact
    ? 1
    : selection.selected.length <= 40
      ? 24
      : selection.selected.length <= 100
        ? 12
        : 6;
  let best: Candidate | undefined;
  let exactExhausted = true;
  for (let restart = 0; restart < restarts; restart += 1) {
    const result = searchAssignments({
      input,
      selected: selection.selected,
      domains,
      baseAssignments,
      constraints,
      exact,
      random,
      deskNeighbors,
    });
    exactExhausted &&= result.exhausted;
    if (!result.best) continue;
    const improved = exact
      ? result.best
      : improveCandidate({
          input,
          candidate: result.best,
          selected: selection.selected,
          domains,
          constraints,
          availableSlots,
          random,
        });
    if (betterCandidate(improved, best)) best = improved;
  }

  if (!best) {
    if (exact && exactExhausted) {
      return {
        status: "infeasible",
        code: "SEATING_INFEASIBLE",
        message: "The seating constraints and parity settings cannot all be satisfied.",
        unseatedStudentIds: [
          ...selection.selected.map((student) => student.studentUserId),
          ...selection.unseated,
        ],
        evidence: {
          kind: "constraintParityConflict",
          affectedStudentIds: selection.selected.map((student) => student.studentUserId),
          malesOnOddDesks: input.genderParityAssignment.malesOnOddDesks,
        },
      };
    }
    return {
      status: "search_exhausted",
      code: "SEATING_SEARCH_EXHAUSTED",
      message: "No valid seating was found within the safe search limit.",
      evidence: buildSearchExhaustedEvidence(input),
    };
  }

  return {
    status: "ok",
    assignments: assignmentsFromCandidate(best, selectedIds),
    meta: {
      unseatedStudentIds: selection.unseated,
      fairnessVector: best.fairnessVector,
      violationCount: 0,
    },
  };
}
