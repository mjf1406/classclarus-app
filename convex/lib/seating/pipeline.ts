import type { Doc, Id } from "../../_generated/dataModel.js";
import {
  deskItemsById,
  findStrictDeskNeighborIds,
  type ChartAssignment,
  type SeatLayoutItemSnapshot,
} from "../seatChartGeometry.js";
import { assignGenderParity, genderBucketFromRoster } from "./gender.js";
import { buildLayoutHistoryStats } from "./history.js";
import { mergeAlgorithmAssignments } from "./mergeAssignments.js";
import { normalizeSeatAlgorithmSettings } from "./settings.js";
import {
  groupIdsInScope,
  inferDefaultScopeFromClassShape,
  inferSeatingScope,
  movableStudentIds,
  type GroupMembershipRow,
} from "./scope.js";
import { SeatingAlgorithmNotImplementedError, solveSeating } from "./solve.js";
import type {
  LockedAssignment,
  SeatingAlgorithmInput,
  SeatingAlgorithmResult,
  SeatingAlgorithmScope,
  SeatingDeskSlot,
  SeatingScopeHint,
  SeatingStudent,
} from "./types.js";
import { validateMergedAssignments } from "./validateOutput.js";

/** Sync slot builder — pass a team resolver (board data on client, DB on server). */
export function buildSeatingDeskSlots(args: {
  layoutItems: Array<SeatLayoutItemSnapshot>;
  groupIds: Array<Id<"groups">>;
  resolveTeamId: (groupId: Id<"groups">, desk: SeatLayoutItemSnapshot) => Id<"teams"> | undefined;
}): Array<SeatingDeskSlot> {
  const neighborMap = findStrictDeskNeighborIds(args.layoutItems);
  const deskById = deskItemsById(args.layoutItems);
  const slots: Array<SeatingDeskSlot> = [];

  for (const groupId of args.groupIds) {
    for (const desk of deskById.values()) {
      const teamId = args.resolveTeamId(groupId, desk);
      const teamKey = teamId !== undefined ? `${groupId}:${teamId}` : undefined;
      slots.push({
        deskItemId: desk.id,
        groupId,
        ...(desk.deskNumber !== undefined ? { deskNumber: desk.deskNumber } : {}),
        ...(desk.zoneName?.trim() ? { zoneName: desk.zoneName.trim() } : {}),
        ...(teamKey !== undefined ? { teamKey } : {}),
        neighborDeskIds: neighborMap.get(desk.id) ?? [],
      });
    }
  }

  return slots;
}

export function buildSeatingStudents(args: {
  memberships: Array<GroupMembershipRow>;
  movableIds: ReadonlyArray<Id<"users">>;
  rosterGenderByStudent: ReadonlyMap<Id<"users">, Doc<"studentRosters">["gender"] | undefined>;
}): Array<SeatingStudent> {
  const movableSet = new Set(args.movableIds);
  const students: Array<SeatingStudent> = [];
  for (const membership of args.memberships) {
    if (!movableSet.has(membership.studentUserId)) continue;
    const gender = args.rosterGenderByStudent.get(membership.studentUserId);
    students.push({
      studentUserId: membership.studentUserId,
      groupId: membership.groupId,
      ...(membership.teamId !== undefined ? { teamId: membership.teamId } : {}),
      ...(gender !== undefined ? { gender } : {}),
      genderBucket: genderBucketFromRoster(gender),
    });
  }
  return students;
}

/** Pure input prep — no Convex ctx. Safe for client bundles. */
export function prepareSeatingAlgorithmInput(args: {
  layoutId: Id<"seatLayouts">;
  layoutItems: Array<SeatLayoutItemSnapshot>;
  lockedAssignments: ReadonlyArray<LockedAssignment>;
  scope?: SeatingAlgorithmScope;
  scopeHint?: SeatingScopeHint;
  randomSeed: string;
  settings: ReturnType<typeof normalizeSeatAlgorithmSettings>;
  constraints: ReadonlyArray<{
    _id: Id<"seatConstraints">;
    type: Doc<"seatConstraints">["type"];
    polarity: Doc<"seatConstraints">["polarity"];
    studentUserId: Id<"users">;
    otherStudentUserId?: Id<"users">;
    zoneName?: string;
  }>;
  memberships: Array<GroupMembershipRow>;
  rosterGenderByStudent: ReadonlyMap<Id<"users">, Doc<"studentRosters">["gender"] | undefined>;
  layoutAggregateRows: Array<
    Pick<Doc<"seatLayoutAggregates">, "studentUserId" | "dimension" | "key" | "count">
  >;
  resolveTeamId: (groupId: Id<"groups">, desk: SeatLayoutItemSnapshot) => Id<"teams"> | undefined;
}): SeatingAlgorithmInput {
  const scope =
    args.scope ??
    inferSeatingScope({
      hint: args.scopeHint,
    }) ??
    inferDefaultScopeFromClassShape({ memberships: args.memberships });

  const lockedStudentUserIds = new Set(
    args.lockedAssignments.map((assignment) => assignment.studentUserId),
  );
  const movableIds = movableStudentIds({
    memberships: args.memberships,
    scope,
    lockedStudentUserIds,
  });
  const activeGroupIds = groupIdsInScope({
    memberships: args.memberships,
    scope,
    lockedAssignments: args.lockedAssignments,
  });

  const genderParityAssignment = assignGenderParity({
    randomSeed: args.randomSeed,
    mode: args.settings.genderParity.mode,
  });

  return {
    layoutId: args.layoutId,
    slots: buildSeatingDeskSlots({
      layoutItems: args.layoutItems,
      groupIds: activeGroupIds,
      resolveTeamId: args.resolveTeamId,
    }),
    students: buildSeatingStudents({
      memberships: args.memberships,
      movableIds,
      rosterGenderByStudent: args.rosterGenderByStudent,
    }),
    locked: args.lockedAssignments.map((assignment) => ({ ...assignment })),
    constraints: args.constraints.map((constraint) => ({
      id: constraint._id,
      type: constraint.type,
      polarity: constraint.polarity,
      studentUserId: constraint.studentUserId,
      ...(constraint.otherStudentUserId !== undefined
        ? { otherStudentUserId: constraint.otherStudentUserId }
        : {}),
      ...(constraint.zoneName !== undefined ? { zoneName: constraint.zoneName } : {}),
    })),
    history: buildLayoutHistoryStats(args.layoutAggregateRows),
    settings: args.settings,
    scope,
    genderParityAssignment,
    randomSeed: args.randomSeed,
  };
}

export function finishSeatingAlgorithm(args: {
  input: SeatingAlgorithmInput;
  lockedAssignments: ReadonlyArray<LockedAssignment>;
  memberships: ReadonlyArray<GroupMembershipRow>;
  deskById: Map<string, SeatLayoutItemSnapshot>;
}):
  | { status: "not_implemented"; message: string; code: "SEATING_ALGORITHM_NOT_IMPLEMENTED" }
  | {
      status: "ok";
      assignments: Array<ChartAssignment>;
      unseatedStudentIds: Array<Id<"users">>;
      violationCount: number;
    }
  | { status: "invalid"; message: string; code: string } {
  const lockedStudentUserIds = new Set(
    args.lockedAssignments.map((assignment) => assignment.studentUserId),
  );
  const movableStudentIdSet = new Set(args.input.students.map((student) => student.studentUserId));

  let solverResult: SeatingAlgorithmResult;
  try {
    solverResult = solveSeating(args.input);
  } catch (error) {
    if (error instanceof SeatingAlgorithmNotImplementedError) {
      return {
        status: "not_implemented",
        message: error.message,
        code: error.code,
      };
    }
    throw error;
  }

  if (solverResult.status === "not_implemented") {
    return solverResult;
  }
  if (solverResult.status === "infeasible") {
    return {
      status: "invalid",
      message: solverResult.message,
      code: "SEATING_INFEASIBLE",
    };
  }

  const merged = mergeAlgorithmAssignments({
    locked: args.lockedAssignments,
    proposed: [...solverResult.assignments],
    movableStudentIds: movableStudentIdSet,
  });

  const membershipGroupByStudent = new Map(
    args.memberships.map((membership) => [membership.studentUserId, membership.groupId]),
  );
  const validationError = validateMergedAssignments({
    assignments: merged,
    deskById: args.deskById,
    membershipGroupByStudent,
    lockedStudentUserIds,
    lockedAssignments: args.lockedAssignments,
  });
  if (validationError) {
    return {
      status: "invalid",
      message: validationError.message,
      code: validationError.code,
    };
  }

  return {
    status: "ok",
    assignments: merged,
    unseatedStudentIds: solverResult.meta.unseatedStudentIds,
    violationCount: solverResult.meta.violationCount,
  };
}
