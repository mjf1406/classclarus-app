import type { Id } from "../../../../convex/_generated/dataModel";
import type { SeatingFailureEvidence } from "../../../../convex/lib/seating/types";
import { collectAllStudents, findStudentOnBoard, type GroupsBoard } from "@/lib/groups/groups";
import { getRosterDisplayName, type RosterNameFormat } from "@/lib/roster/roster";

export type UnavailableStudentReason = "ungrouped" | "notOnBoard" | "staleRoster" | "inSolverPool";

export type StudentFailureContext = {
  studentUserId: Id<"users">;
  availability: UnavailableStudentReason;
  groupId?: Id<"groups">;
  teamId?: Id<"teams">;
  groupName?: string;
  teamName?: string;
};

function groupedStudentIds(board: GroupsBoard): Set<Id<"users">> {
  const ids = new Set<Id<"users">>();
  for (const group of board.groups) {
    for (const student of group.students) {
      ids.add(student.userId);
    }
    for (const team of group.teams) {
      for (const student of team.students) {
        ids.add(student.userId);
      }
    }
  }
  return ids;
}

function ungroupedStudentIds(board: GroupsBoard): Set<Id<"users">> {
  return new Set(board.ungrouped.map((student) => student.userId));
}

export function classifyStudentAvailability(
  studentUserId: Id<"users">,
  board: GroupsBoard,
  rosterUserIds: ReadonlySet<Id<"users">>,
  solverStudentIds: ReadonlySet<Id<"users">>,
): StudentFailureContext {
  const located = findStudentOnBoard(board, studentUserId);
  const groupContext = (() => {
    if (!located) return {};
    const from = located.from;
    if (from.kind === "ungrouped") return {};
    const group = board.groups.find((item) => item._id === from.groupId);
    if (!group) return {};
    if (from.kind === "team") {
      const team = group.teams.find((item) => item._id === from.teamId);
      return {
        groupId: group._id,
        groupName: group.name,
        teamId: from.teamId,
        teamName: team?.name,
      };
    }
    return { groupId: group._id, groupName: group.name };
  })();

  if (!rosterUserIds.has(studentUserId)) {
    return {
      studentUserId,
      availability: "staleRoster",
      ...groupContext,
    };
  }

  if (solverStudentIds.has(studentUserId)) {
    return {
      studentUserId,
      availability: "inSolverPool",
      ...groupContext,
    };
  }

  if (ungroupedStudentIds(board).has(studentUserId)) {
    return { studentUserId, availability: "ungrouped" };
  }

  if (!groupedStudentIds(board).has(studentUserId)) {
    return { studentUserId, availability: "notOnBoard" };
  }

  return {
    studentUserId,
    availability: "notOnBoard",
    ...groupContext,
  };
}

export function studentContextsForEvidence(
  evidence: SeatingFailureEvidence | undefined,
  board: GroupsBoard,
  rosterUserIds: ReadonlySet<Id<"users">>,
  solverStudentIds: ReadonlySet<Id<"users">>,
): Map<Id<"users">, StudentFailureContext> {
  const map = new Map<Id<"users">, StudentFailureContext>();
  if (!evidence) return map;

  const studentIds = new Set<Id<"users">>();
  switch (evidence.kind) {
    case "unavailableStudents":
      for (const student of evidence.students) {
        studentIds.add(student.studentUserId);
      }
      break;
    case "capacityExceeded":
      for (const group of evidence.groups) {
        for (const id of group.requiredStudentIds) {
          studentIds.add(id);
        }
      }
      break;
    case "noValidSeat":
      for (const student of evidence.students) {
        studentIds.add(student.studentUserId);
      }
      break;
    case "unavailableSeat":
    case "parityLockedConflict":
    case "manualConstraintConflict":
      for (const lock of evidence.locks) {
        studentIds.add(lock.studentUserId);
      }
      break;
    case "duplicateManual":
      for (const id of evidence.duplicateStudentIds) {
        studentIds.add(id);
      }
      break;
    case "constraintParityConflict":
      for (const id of evidence.affectedStudentIds) {
        studentIds.add(id);
      }
      break;
    case "searchExhausted":
      break;
    default:
      break;
  }

  for (const studentUserId of studentIds) {
    map.set(
      studentUserId,
      classifyStudentAvailability(studentUserId, board, rosterUserIds, solverStudentIds),
    );
  }

  return map;
}

type RosterStudentLike = Parameters<typeof getRosterDisplayName>[0];

export function buildFailureStudentNameResolver(args: {
  board: GroupsBoard | undefined;
  roster: ReadonlyArray<RosterStudentLike> | undefined;
  nameFormat: RosterNameFormat;
  unnamed: string;
  removedLabel: string;
}): (userId: Id<"users">) => string {
  const map = new Map<Id<"users">, string>();
  for (const student of args.roster ?? []) {
    map.set(student.userId, getRosterDisplayName(student, args.unnamed, args.nameFormat));
  }
  if (args.board) {
    for (const student of collectAllStudents(args.board)) {
      if (!map.has(student.userId)) {
        map.set(student.userId, getRosterDisplayName(student, args.unnamed, args.nameFormat));
      }
    }
  }
  return (userId) => map.get(userId) ?? args.removedLabel;
}
