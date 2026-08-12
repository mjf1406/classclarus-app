import type { Id } from "../../../../convex/_generated/dataModel";
import type { GroupMembershipRow } from "../../../../convex/lib/seating/scope";
import {
  deskItemsById,
  type SeatLayoutItemSnapshot,
} from "../../../../convex/lib/seatChartGeometry";
import {
  finishSeatingAlgorithm,
  prepareSeatingAlgorithmInput,
} from "../../../../convex/lib/seating/pipeline";
import {
  applySeatingRelaxations,
  diagnoseSeatingConflicts,
} from "../../../../convex/lib/seating/diagnose";
import type {
  GenderParityMode,
  SeatingConflictDiagnosis,
  SeatingRelaxations,
} from "../../../../convex/lib/seating/types";
import { teamHistoryKey } from "../../../../convex/lib/seating/historyKeys";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { collectAllStudents, type GroupsBoard } from "@/lib/groups/groups";
import type { SeatChartAssignment } from "@/lib/assigners/seatCharts";

export type ClientSeatConstraint = {
  _id: Id<"seatConstraints">;
  type: "neighbor" | "teammate" | "zone";
  polarity: "must" | "mustNot";
  studentUserId: Id<"users">;
  otherStudentUserId?: Id<"users">;
  zoneName?: string;
};

export type ClientSeatingLayout = {
  _id: Id<"seatLayouts">;
  items: Array<SeatLayoutItemSnapshot>;
  genderParity?: { mode: GenderParityMode };
};

export type RunClientSeatingAlgorithmArgs = {
  layout: ClientSeatingLayout;
  board: GroupsBoard;
  constraints: ReadonlyArray<ClientSeatConstraint>;
  lockedAssignments: ReadonlyArray<SeatChartAssignment>;
  layoutAggregateRows: Array<
    Pick<Doc<"seatLayoutAggregates">, "studentUserId" | "dimension" | "key" | "count">
  >;
  randomSeed?: string;
  /** Temporary relaxations for this attempt only — saved constraints are unchanged. */
  relaxations?: SeatingRelaxations;
};

export type RunClientSeatingAlgorithmFailure = {
  status: "invalid";
  message: string;
  code: string;
  diagnosis: SeatingConflictDiagnosis;
  solverStudentIds: Array<Id<"users">>;
};

export type RunClientSeatingAlgorithmResult =
  | {
      status: "ok";
      assignments: Array<SeatChartAssignment>;
      unseatedStudentIds: Array<Id<"users">>;
      violationCount: number;
      appliedRelaxations?: SeatingRelaxations;
    }
  | RunClientSeatingAlgorithmFailure;

function membershipsFromBoard(board: GroupsBoard): Array<GroupMembershipRow> {
  const byStudent = new Map<Id<"users">, GroupMembershipRow>();
  for (const group of board.groups) {
    for (const student of group.students) {
      byStudent.set(student.userId, {
        studentUserId: student.userId,
        groupId: group._id,
      });
    }
    for (const team of group.teams) {
      for (const student of team.students) {
        byStudent.set(student.userId, {
          studentUserId: student.userId,
          groupId: group._id,
          teamId: team._id,
        });
      }
    }
  }
  return [...byStudent.values()];
}

function genderByStudentFromBoard(
  board: GroupsBoard,
): Map<Id<"users">, GroupsBoard["groups"][number]["students"][number]["gender"] | undefined> {
  const map = new Map<
    Id<"users">,
    GroupsBoard["groups"][number]["students"][number]["gender"] | undefined
  >();
  for (const group of board.groups) {
    for (const student of group.students) {
      map.set(student.userId, student.gender);
    }
    for (const team of group.teams) {
      for (const student of team.students) {
        map.set(student.userId, student.gender);
      }
    }
  }
  for (const student of board.ungrouped) {
    map.set(student.userId, student.gender);
  }
  return map;
}

/** Drop rules that reference students no longer present on the groups board. */
export function filterConstraintsForBoard(
  constraints: ReadonlyArray<ClientSeatConstraint>,
  board: GroupsBoard,
): Array<ClientSeatConstraint> {
  const boardStudentIds = new Set(collectAllStudents(board).map((student) => student.userId));
  return constraints.filter((constraint) => {
    if (!boardStudentIds.has(constraint.studentUserId)) return false;
    if (constraint.otherStudentUserId && !boardStudentIds.has(constraint.otherStudentUserId)) {
      return false;
    }
    return true;
  });
}

function resolveTeamIdFromBoard(
  board: GroupsBoard,
  groupId: Id<"groups">,
  desk: SeatLayoutItemSnapshot,
): Id<"teams"> | undefined {
  const assignment = desk.teamAssignment;
  if (!assignment) return undefined;
  const group = board.groups.find((item) => item._id === groupId);
  if (!group) return undefined;

  if (assignment.mode === "single") {
    if (assignment.groupId !== groupId) return undefined;
    return group.teams.some((team) => team._id === assignment.teamId)
      ? assignment.teamId
      : undefined;
  }

  const target = assignment.teamName.trim().toLowerCase();
  if (!target) return undefined;
  return group.teams.find((team) => team.name.trim().toLowerCase() === target)?._id;
}

/**
 * Run the seating solver on the client using board / layout / constraints
 * already loaded via TanStack Query hooks.
 */
export function runClientSeatingAlgorithm(
  args: RunClientSeatingAlgorithmArgs,
): RunClientSeatingAlgorithmResult {
  const activeConstraints = filterConstraintsForBoard(args.constraints, args.board);
  const memberships = membershipsFromBoard(args.board);
  const rosterGenderByStudent = genderByStudentFromBoard(args.board);
  const lockedAssignments = args.lockedAssignments.map((assignment) => ({
    deskItemId: assignment.deskItemId,
    groupId: assignment.groupId,
    studentUserId: assignment.studentUserId,
  }));
  const deskById = deskItemsById(args.layout.items);
  const randomSeed =
    args.randomSeed?.trim() ||
    `${args.layout._id}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

  const genderParityMode = args.layout.genderParity?.mode === "off" ? "off" : "oddEven";

  const input = prepareSeatingAlgorithmInput({
    layoutId: args.layout._id,
    layoutItems: args.layout.items,
    lockedAssignments,
    scope: { kind: "class" },
    randomSeed,
    genderParityMode,
    constraints: activeConstraints,
    memberships,
    rosterGenderByStudent,
    layoutAggregateRows: args.layoutAggregateRows,
    resolveTeamKey: (groupId, desk) => {
      if (
        !resolveTeamIdFromBoard(args.board, groupId, desk) &&
        desk.teamAssignment?.mode === "single"
      ) {
        return undefined;
      }
      return teamHistoryKey(groupId, desk.teamAssignment);
    },
  });

  const relaxedInput = args.relaxations ? applySeatingRelaxations(input, args.relaxations) : input;

  const result = finishSeatingAlgorithm({
    input: relaxedInput,
    lockedAssignments: relaxedInput.locked,
    memberships,
    deskById,
  });

  if (result.status !== "ok") {
    const diagnosis = diagnoseSeatingConflicts(relaxedInput);
    return {
      status: "invalid",
      message: result.message,
      code: result.code,
      diagnosis,
      solverStudentIds: relaxedInput.students.map((student) => student.studentUserId),
    };
  }

  return {
    status: "ok",
    assignments: result.assignments.map((assignment) => ({
      deskItemId: assignment.deskItemId,
      groupId: assignment.groupId,
      studentUserId: assignment.studentUserId,
    })),
    unseatedStudentIds: result.unseatedStudentIds,
    violationCount: result.violationCount,
    ...(args.relaxations ? { appliedRelaxations: args.relaxations } : {}),
  };
}
