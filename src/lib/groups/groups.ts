import type { FunctionReturnType } from "convex/server";

import type { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  DEFAULT_ROSTER_NAME_FORMAT,
  formatRosterNameParts,
  GENDER_OPTIONS,
  type GenderOption,
  type RosterNameFormat,
} from "@/lib/roster/roster";

export type GroupsBoard = FunctionReturnType<typeof api.groups.board>;
export type BoardGroup = GroupsBoard["groups"][number];
export type BoardTeam = BoardGroup["teams"][number];
export type BoardStudent = GroupsBoard["ungrouped"][number];

export type GroupGenderCount = {
  gender: GenderOption | null;
  count: number;
};

/** Flatten teamless + team students in a group (unique by userId). */
export function collectStudentsInGroup(group: BoardGroup): Array<BoardStudent> {
  const byId = new Map<Id<"users">, BoardStudent>();
  for (const student of group.students) {
    byId.set(student.userId, student);
  }
  for (const team of group.teams) {
    for (const student of team.students) {
      byId.set(student.userId, student);
    }
  }
  return [...byId.values()];
}

/** Teamless students plus students on every team in the group. */
export function countStudentsInGroup(group: BoardGroup): number {
  return collectStudentsInGroup(group).length;
}

/** Gender tallies for a group, ordered like roster gender options; unset last. */
export function countGendersInGroup(group: BoardGroup): Array<GroupGenderCount> {
  const counts = new Map<GenderOption | "unset", number>();
  for (const student of collectStudentsInGroup(group)) {
    const gender = readBoardStudentGender(student);
    const key = gender ?? "unset";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const result: Array<GroupGenderCount> = [];
  for (const gender of GENDER_OPTIONS) {
    const count = counts.get(gender);
    if (count != null && count > 0) {
      result.push({ gender, count });
    }
  }
  const unset = counts.get("unset");
  if (unset != null && unset > 0) {
    result.push({ gender: null, count: unset });
  }
  return result;
}

function readBoardStudentGender(student: BoardStudent): GenderOption | undefined {
  const gender = (student as { gender?: unknown }).gender;
  if (typeof gender === "string" && (GENDER_OPTIONS as readonly string[]).includes(gender)) {
    return gender as GenderOption;
  }
  return undefined;
}

export type GroupFormValues = {
  name: string;
  description?: string;
  icon?: string;
  imageFileId?: Id<"files">;
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
  nameFormat: RosterNameFormat = DEFAULT_ROSTER_NAME_FORMAT,
): GroupsBoard {
  const found = findStudentOnBoard(board, studentUserId);
  if (!found) return board;

  const { student } = found;
  const without = removeStudentFromBoard(board, studentUserId);

  if (to.kind === "ungrouped") {
    return {
      ...without,
      ungrouped: sortStudents([...without.ungrouped, student], nameFormat),
    };
  }

  return {
    ...without,
    groups: without.groups.map((group) => {
      if (group._id !== to.groupId) return group;
      if (to.kind === "group") {
        return {
          ...group,
          students: sortStudents([...group.students, student], nameFormat),
        };
      }
      return {
        ...group,
        teams: group.teams.map((team) =>
          team._id === to.teamId
            ? { ...team, students: sortStudents([...team.students, student], nameFormat) }
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
  nameFormat: RosterNameFormat = DEFAULT_ROSTER_NAME_FORMAT,
): GroupsBoard {
  return studentUserIds.reduce(
    (next, studentUserId) => moveStudentOnBoard(next, studentUserId, to, nameFormat),
    board,
  );
}

/** Move every student in a group (including teams) to the ungrouped pool. */
export function clearGroupStudentsOnBoard(
  board: GroupsBoard,
  groupId: Id<"groups">,
  nameFormat: RosterNameFormat = DEFAULT_ROSTER_NAME_FORMAT,
): GroupsBoard {
  const group = board.groups.find((item) => item._id === groupId);
  if (!group) return board;

  const released = [...group.students, ...group.teams.flatMap((team) => team.students)];
  if (released.length === 0) return board;

  return {
    ungrouped: sortStudents([...board.ungrouped, ...released], nameFormat),
    groups: board.groups.map((item) =>
      item._id !== groupId
        ? item
        : {
            ...item,
            students: [],
            teams: item.teams.map((team) => ({ ...team, students: [] })),
          },
    ),
  };
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
  nameFormat: RosterNameFormat = DEFAULT_ROSTER_NAME_FORMAT,
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

  return sortStudents(
    candidates.filter((student) => !inDestination.has(student.userId)),
    nameFormat,
  );
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

/** Flatten every student on the board (ungrouped + groups + teams), unique by userId. */
export function collectAllStudents(board: GroupsBoard): Array<BoardStudent> {
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

function boardStudentSortKey(student: BoardStudent, format: RosterNameFormat): string {
  const rosterName = formatRosterNameParts(student.firstName, student.lastName, format);
  return (rosterName ?? student.name ?? student.email ?? student.userId).toLocaleLowerCase();
}

export function sortStudents(
  students: Array<BoardStudent>,
  nameFormat: RosterNameFormat = DEFAULT_ROSTER_NAME_FORMAT,
): Array<BoardStudent> {
  return [...students].sort((a, b) =>
    boardStudentSortKey(a, nameFormat).localeCompare(boardStudentSortKey(b, nameFormat)),
  );
}
