import type { Id } from "../../../../convex/_generated/dataModel";
import type { GroupMembershipRow } from "../../../../convex/lib/seating/scope";
import type { SeatLayoutItemSnapshot } from "../../../../convex/lib/seatChartGeometry";
import { deskItemsById } from "../../../../convex/lib/seatChartGeometry";
import {
  finishSeatingAlgorithm,
  prepareSeatingAlgorithmInput,
} from "../../../../convex/lib/seating/pipeline";
import { normalizeSeatAlgorithmSettings } from "../../../../convex/lib/seating/settings";
import type { SeatAlgorithmSettings } from "../../../../convex/lib/seating/types";
import type { GroupsBoard } from "@/lib/groups/groups";
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
};

export type RunClientSeatingAlgorithmArgs = {
  layout: ClientSeatingLayout;
  board: GroupsBoard;
  settings: SeatAlgorithmSettings | null | undefined;
  constraints: ReadonlyArray<ClientSeatConstraint>;
  lockedAssignments: ReadonlyArray<SeatChartAssignment>;
  randomSeed?: string;
};

export type RunClientSeatingAlgorithmResult =
  | {
      status: "ok";
      assignments: Array<SeatChartAssignment>;
      unseatedStudentIds: Array<Id<"users">>;
      violationCount: number;
    }
  | { status: "not_implemented"; message: string; code: "SEATING_ALGORITHM_NOT_IMPLEMENTED" }
  | { status: "invalid"; message: string; code: string };

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
 * Run the seating solver on the client using board / layout / settings / constraints
 * already loaded via hooks. History aggregates are empty until a client query exists.
 * Implement the solver in `convex/lib/seating/solve.ts`.
 */
export function runClientSeatingAlgorithm(
  args: RunClientSeatingAlgorithmArgs,
): RunClientSeatingAlgorithmResult {
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

  const input = prepareSeatingAlgorithmInput({
    layoutId: args.layout._id,
    layoutItems: args.layout.items,
    lockedAssignments,
    scope: { kind: "class" },
    randomSeed,
    settings: normalizeSeatAlgorithmSettings(args.settings ?? undefined),
    constraints: args.constraints,
    memberships,
    rosterGenderByStudent,
    layoutAggregateRows: [],
    resolveTeamId: (groupId, desk) => resolveTeamIdFromBoard(args.board, groupId, desk),
  });

  const result = finishSeatingAlgorithm({
    input,
    lockedAssignments,
    memberships,
    deskById,
  });

  if (result.status !== "ok") return result;

  return {
    status: "ok",
    assignments: result.assignments.map((assignment) => ({
      deskItemId: assignment.deskItemId,
      groupId: assignment.groupId,
      studentUserId: assignment.studentUserId,
    })),
    unseatedStudentIds: result.unseatedStudentIds,
    violationCount: result.violationCount,
  };
}
