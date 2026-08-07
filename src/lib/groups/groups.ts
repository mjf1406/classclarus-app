import type { FunctionReturnType } from "convex/server";

import type { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export type GroupsBoard = FunctionReturnType<typeof api.groups.board>;
export type BoardGroup = GroupsBoard["groups"][number];
export type BoardTeam = BoardGroup["teams"][number];
export type BoardStudent = GroupsBoard["ungrouped"][number];

export type GroupFormValues = {
  name: string;
  description?: string;
  icon?: string;
};

export type DropTarget =
  | { kind: "ungrouped" }
  | { kind: "group"; groupId: Id<"groups"> }
  | { kind: "team"; groupId: Id<"groups">; teamId: Id<"teams"> };

export function findStudentOnBoard(
  board: GroupsBoard,
  studentUserId: Id<"users">,
): {
  student: BoardStudent;
  from: DropTarget;
} | null {
  for (const student of board.ungrouped) {
    if (student.userId === studentUserId) {
      return { student, from: { kind: "ungrouped" } };
    }
  }
  for (const group of board.groups) {
    for (const student of group.students) {
      if (student.userId === studentUserId) {
        return { student, from: { kind: "group", groupId: group._id } };
      }
    }
    for (const team of group.teams) {
      for (const student of team.students) {
        if (student.userId === studentUserId) {
          return {
            student,
            from: { kind: "team", groupId: group._id, teamId: team._id },
          };
        }
      }
    }
  }
  return null;
}

export function moveStudentOnBoard(
  board: GroupsBoard,
  studentUserId: Id<"users">,
  to: DropTarget,
): GroupsBoard {
  const found = findStudentOnBoard(board, studentUserId);
  if (!found) return board;

  const { student } = found;
  const without = removeStudentFromBoard(board, studentUserId);

  if (to.kind === "ungrouped") {
    return {
      ...without,
      ungrouped: sortStudents([...without.ungrouped, student]),
    };
  }

  return {
    ...without,
    groups: without.groups.map((group) => {
      if (group._id !== to.groupId) return group;
      if (to.kind === "group") {
        return {
          ...group,
          students: sortStudents([...group.students, student]),
        };
      }
      return {
        ...group,
        teams: group.teams.map((team) =>
          team._id === to.teamId
            ? { ...team, students: sortStudents([...team.students, student]) }
            : team,
        ),
      };
    }),
  };
}

export function moveStudentsOnBoard(
  board: GroupsBoard,
  studentUserIds: Array<Id<"users">>,
  to: DropTarget,
): GroupsBoard {
  return studentUserIds.reduce(
    (next, studentUserId) => moveStudentOnBoard(next, studentUserId, to),
    board,
  );
}

export type MoveStudentsFilter =
  | { kind: "ungrouped" }
  | { kind: "inGroups"; groupIds: Array<Id<"groups">> }
  | { kind: "notInGroups"; groupIds: Array<Id<"groups">> };

/** Students already in the destination group (any team) are excluded. */
export function filterStudentsForMoveIntoGroup(
  board: GroupsBoard,
  destinationGroupId: Id<"groups">,
  filter: MoveStudentsFilter,
): Array<BoardStudent> {
  const inDestination = new Set(
    collectStudentsInGroups(board, [destinationGroupId]).map((student) => student.userId),
  );

  let candidates: Array<BoardStudent>;
  if (filter.kind === "ungrouped") {
    candidates = board.ungrouped;
  } else if (filter.kind === "inGroups") {
    if (filter.groupIds.length === 0) return [];
    candidates = collectStudentsInGroups(board, filter.groupIds);
  } else {
    if (filter.groupIds.length === 0) return [];
    const excluded = new Set(
      collectStudentsInGroups(board, filter.groupIds).map((student) => student.userId),
    );
    candidates = collectAllStudents(board).filter((student) => !excluded.has(student.userId));
  }

  return sortStudents(candidates.filter((student) => !inDestination.has(student.userId)));
}

function collectStudentsInGroups(
  board: GroupsBoard,
  groupIds: Array<Id<"groups">>,
): Array<BoardStudent> {
  const wanted = new Set(groupIds);
  const byId = new Map<Id<"users">, BoardStudent>();
  for (const group of board.groups) {
    if (!wanted.has(group._id)) continue;
    for (const student of group.students) {
      byId.set(student.userId, student);
    }
    for (const team of group.teams) {
      for (const student of team.students) {
        byId.set(student.userId, student);
      }
    }
  }
  return [...byId.values()];
}

function collectAllStudents(board: GroupsBoard): Array<BoardStudent> {
  const byId = new Map<Id<"users">, BoardStudent>();
  for (const student of board.ungrouped) {
    byId.set(student.userId, student);
  }
  for (const group of board.groups) {
    for (const student of group.students) {
      byId.set(student.userId, student);
    }
    for (const team of group.teams) {
      for (const student of team.students) {
        byId.set(student.userId, student);
      }
    }
  }
  return [...byId.values()];
}

function removeStudentFromBoard(board: GroupsBoard, studentUserId: Id<"users">): GroupsBoard {
  return {
    ungrouped: board.ungrouped.filter((student) => student.userId !== studentUserId),
    groups: board.groups.map((group) => ({
      ...group,
      students: group.students.filter((student) => student.userId !== studentUserId),
      teams: group.teams.map((team) => ({
        ...team,
        students: team.students.filter((student) => student.userId !== studentUserId),
      })),
    })),
  };
}

function sortStudents(students: Array<BoardStudent>): Array<BoardStudent> {
  return [...students].sort((a, b) => {
    const nameA = (a.name ?? a.email ?? a.userId).toLocaleLowerCase();
    const nameB = (b.name ?? b.email ?? b.userId).toLocaleLowerCase();
    return nameA.localeCompare(nameB);
  });
}
