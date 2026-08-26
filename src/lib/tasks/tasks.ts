import type { FunctionReturnType } from "convex/server";

import { isPastDue } from "@/lib/dueDate/dueDateKey";
import { collectStudentsInGroup, type GroupsBoard } from "@/lib/groups/groups";
import { getRosterDisplayName, type StudentRosterEntry } from "@/lib/roster/roster";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export type TaskListItem = FunctionReturnType<typeof api.tasks.list>[number];
export type TaskList = FunctionReturnType<typeof api.tasks.list>;
export type TaskDetail = NonNullable<FunctionReturnType<typeof api.tasks.get>>;
export type TaskDetailClass = Extract<TaskDetail, { scope: "class" }>;
export type TaskDetailPersonal = Extract<TaskDetail, { scope: "personal" }>;

export function isClassTaskDetail(detail: TaskDetail): detail is TaskDetailClass {
  return detail.scope === "class";
}

export function isPersonalTaskDetail(detail: TaskDetail): detail is TaskDetailPersonal {
  return detail.scope === "personal";
}

/** True when the task due date/time is before now (date-only: before today). */
export function isTaskPastDue(dueDateKey: string | undefined, now: Date = new Date()): boolean {
  return isPastDue(dueDateKey, now);
}

export const MAX_TASK_NAME_LENGTH = 100;
export const MAX_TASK_DESCRIPTION_LENGTH = 500;

export type TaskSortKey = "name" | "created" | "updated";
export type TaskSortDirection = "asc" | "desc";

export function compareTasks(
  a: TaskListItem,
  b: TaskListItem,
  sortKey: TaskSortKey,
  direction: TaskSortDirection,
): number {
  const dir = direction === "asc" ? 1 : -1;
  switch (sortKey) {
    case "name": {
      const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      if (byName !== 0) return byName * dir;
      return (a.updatedAt - b.updatedAt) * dir;
    }
    case "created":
      return (a._creationTime - b._creationTime) * dir;
    case "updated":
      return (a.updatedAt - b.updatedAt) * dir;
  }
}

export function sortTasks(
  tasks: readonly TaskListItem[],
  sortKey: TaskSortKey,
  direction: TaskSortDirection,
): TaskListItem[] {
  return [...tasks].sort((a, b) => compareTasks(a, b, sortKey, direction));
}

export function nextTaskSortState(
  currentKey: TaskSortKey,
  currentDirection: TaskSortDirection,
  nextKey: TaskSortKey,
): { sortKey: TaskSortKey; sortDirection: TaskSortDirection } {
  if (currentKey === nextKey) {
    return {
      sortKey: currentKey,
      sortDirection: currentDirection === "asc" ? "desc" : "asc",
    };
  }
  return {
    sortKey: nextKey,
    sortDirection: nextKey === "name" ? "asc" : "desc",
  };
}

export function filterTasksByName(tasks: readonly TaskListItem[], query: string): TaskListItem[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [...tasks];
  return tasks.filter((task) => {
    if (task.name.toLocaleLowerCase().includes(needle)) return true;
    if (task.description?.toLocaleLowerCase().includes(needle)) return true;
    if (task.assignmentName?.toLocaleLowerCase().includes(needle)) return true;
    if (task.assignmentSubject?.toLocaleLowerCase().includes(needle)) return true;
    if (task.assignmentUnit?.toLocaleLowerCase().includes(needle)) return true;
    return false;
  });
}

export type TaskAssignmentGroup = {
  assignmentId: NonNullable<TaskListItem["assignmentId"]>;
  assignmentName: string;
  assignmentSubject?: string;
  assignmentUnit?: string;
  tasks: TaskListItem[];
};

export function formatTaskAssignmentFolderMeta(group: {
  assignmentSubject?: string;
  assignmentUnit?: string;
}): string | null {
  const parts = [group.assignmentSubject, group.assignmentUnit].filter((part): part is string =>
    Boolean(part?.trim()),
  );
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

/** Sort assignment-folder tasks by procedure step number ascending. */
export function sortTasksByProcedureStep(tasks: readonly TaskListItem[]): TaskListItem[] {
  return [...tasks].sort((a, b) => {
    const aStep = a.procedureStepNumber;
    const bStep = b.procedureStepNumber;
    if (aStep !== undefined && bStep !== undefined && aStep !== bStep) {
      return aStep - bStep;
    }
    if (aStep !== undefined && bStep === undefined) return -1;
    if (aStep === undefined && bStep !== undefined) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

/** Partition sorted tasks into assignment folders + ungrouped tasks (order preserved). */
export function groupTasksByAssignment(tasks: readonly TaskListItem[]): {
  groups: TaskAssignmentGroup[];
  ungrouped: TaskListItem[];
} {
  const groupMap = new Map<string, TaskAssignmentGroup>();
  const ungrouped: TaskListItem[] = [];

  for (const task of tasks) {
    if (task.assignmentId && task.assignmentName) {
      const key = task.assignmentId;
      const existing = groupMap.get(key);
      if (existing) {
        existing.tasks.push(task);
      } else {
        groupMap.set(key, {
          assignmentId: task.assignmentId,
          assignmentName: task.assignmentName,
          ...(task.assignmentSubject ? { assignmentSubject: task.assignmentSubject } : {}),
          ...(task.assignmentUnit ? { assignmentUnit: task.assignmentUnit } : {}),
          tasks: [task],
        });
      }
      continue;
    }
    ungrouped.push(task);
  }

  const groups = [...groupMap.values()]
    .map((group) => ({
      ...group,
      tasks: sortTasksByProcedureStep(group.tasks),
    }))
    .sort((a, b) =>
      a.assignmentName.localeCompare(b.assignmentName, undefined, { sensitivity: "base" }),
    );

  return { groups, ungrouped };
}

export type TaskGroupCompletionStat = {
  groupId: Id<"groups"> | "ungrouped";
  name: string;
  completedCount: number;
  studentCount: number;
};

function studentInScope(
  userId: string,
  includedStudentIds: ReadonlySet<string> | undefined,
): boolean {
  return includedStudentIds === undefined || includedStudentIds.has(userId);
}

/** Per-group (and ungrouped) completion counts. Empty when the class has no groups. */
export function computeTaskGroupCompletionStats(args: {
  board: GroupsBoard;
  completedStudentIds: ReadonlySet<string>;
  /** When set, only these students are counted (e.g. after group/team filters). */
  includedStudentIds?: ReadonlySet<string>;
  ungroupedLabel: string;
}): TaskGroupCompletionStat[] {
  if (args.board.groups.length === 0) {
    return [];
  }

  const rows: TaskGroupCompletionStat[] = [];
  for (const group of args.board.groups) {
    const students = collectStudentsInGroup(group).filter((student) =>
      studentInScope(student.userId, args.includedStudentIds),
    );
    if (students.length === 0) {
      continue;
    }
    rows.push({
      groupId: group._id,
      name: group.name,
      completedCount: students.filter((student) => args.completedStudentIds.has(student.userId))
        .length,
      studentCount: students.length,
    });
  }

  const ungrouped = args.board.ungrouped.filter((student) =>
    studentInScope(student.userId, args.includedStudentIds),
  );
  if (ungrouped.length > 0) {
    rows.push({
      groupId: "ungrouped",
      name: args.ungroupedLabel,
      completedCount: ungrouped.filter((student) => args.completedStudentIds.has(student.userId))
        .length,
      studentCount: ungrouped.length,
    });
  }

  return rows;
}

/** First name for the grid card; last name only when roster first+last are both set. */
export function taskStudentCardNames(
  student: Pick<StudentRosterEntry, "userId" | "firstName" | "lastName" | "name" | "email">,
  unnamedFallback: string,
): { firstName: string; lastName?: string } {
  const first = student.firstName?.trim() ?? "";
  const last = student.lastName?.trim() ?? "";
  if (first && last) {
    return { firstName: first, lastName: last };
  }
  if (first) {
    return { firstName: first };
  }
  if (last) {
    return { firstName: last };
  }
  return { firstName: getRosterDisplayName(student, unnamedFallback) };
}

export type TaskStudentSortKey = "firstName" | "lastName" | "rosterNumber" | "done";
export const TASK_STUDENT_SORT_KEYS = [
  "firstName",
  "lastName",
  "rosterNumber",
  "done",
] as const satisfies readonly TaskStudentSortKey[];

function namePart(value: string | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

export function nextTaskStudentSortState(
  currentKey: TaskStudentSortKey,
  currentDirection: TaskSortDirection,
  nextKey: TaskStudentSortKey,
): { sortKey: TaskStudentSortKey; sortDirection: TaskSortDirection } {
  if (currentKey === nextKey) {
    return {
      sortKey: currentKey,
      sortDirection: currentDirection === "asc" ? "desc" : "asc",
    };
  }
  return {
    sortKey: nextKey,
    // Names / roster #: A→Z / low→high. Done: completed first.
    sortDirection: nextKey === "done" ? "desc" : "asc",
  };
}

export function compareTaskStudents(
  a: StudentRosterEntry,
  b: StudentRosterEntry,
  sortKey: TaskStudentSortKey,
  direction: TaskSortDirection,
  completedStudentIds: ReadonlySet<string>,
): number {
  const dir = direction === "asc" ? 1 : -1;
  switch (sortKey) {
    case "firstName": {
      const byFirst = namePart(a.firstName).localeCompare(namePart(b.firstName));
      if (byFirst !== 0) return byFirst * dir;
      const byLast = namePart(a.lastName).localeCompare(namePart(b.lastName));
      if (byLast !== 0) return byLast * dir;
      return (a.rosterNumber - b.rosterNumber) * dir;
    }
    case "lastName": {
      const byLast = namePart(a.lastName).localeCompare(namePart(b.lastName));
      if (byLast !== 0) return byLast * dir;
      const byFirst = namePart(a.firstName).localeCompare(namePart(b.firstName));
      if (byFirst !== 0) return byFirst * dir;
      return (a.rosterNumber - b.rosterNumber) * dir;
    }
    case "rosterNumber":
      return (a.rosterNumber - b.rosterNumber) * dir;
    case "done": {
      const byDone =
        Number(completedStudentIds.has(a.userId)) - Number(completedStudentIds.has(b.userId));
      if (byDone !== 0) return byDone * dir;
      return (a.rosterNumber - b.rosterNumber) * dir;
    }
  }
}

export function sortTaskStudents(
  students: readonly StudentRosterEntry[],
  sortKey: TaskStudentSortKey,
  direction: TaskSortDirection,
  completedStudentIds: ReadonlySet<string>,
): StudentRosterEntry[] {
  return [...students].sort((a, b) =>
    compareTaskStudents(a, b, sortKey, direction, completedStudentIds),
  );
}
