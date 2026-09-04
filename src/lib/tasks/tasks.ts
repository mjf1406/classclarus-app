import type { FunctionReturnType } from "convex/server";

import { isPastDue } from "@/lib/dueDate/dueDateKey";
import { collectStudentsInGroup, type GroupsBoard } from "@/lib/groups/groups";
import type { StudentRosterEntry } from "@/lib/roster/roster";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  compareTaskSortOrder,
  type TaskTopLevelRef,
} from "../../../convex/lib/tasks/taskSortOrder";

export type TaskListItem = FunctionReturnType<typeof api.tasks.list>[number];
export type TaskList = FunctionReturnType<typeof api.tasks.list>;
export type TaskDetail = NonNullable<FunctionReturnType<typeof api.tasks.get>>;
export type TaskDetailClass = Extract<TaskDetail, { scope: "class" }>;
export type TaskDetailPersonal = Extract<TaskDetail, { scope: "personal" }>;

export function isClassTaskDetail(detail: TaskDetail): detail is TaskDetailClass {
  return detail.scope === "class";
}

export function isTaskArchived(task: { archivedAt?: number }): boolean {
  return task.archivedAt !== undefined;
}

export function partitionTasksByArchive<T extends { archivedAt?: number }>(
  tasks: readonly T[],
): { active: T[]; archived: T[] } {
  const active: T[] = [];
  const archived: T[] = [];
  for (const task of tasks) {
    if (isTaskArchived(task)) {
      archived.push(task);
    } else {
      active.push(task);
    }
  }
  return { active, archived };
}

export function countTaskCompletionsForStudents(
  task: { completedStudentIds?: readonly string[] },
  studentUserIds: readonly string[],
): number {
  if (studentUserIds.length === 0) return 0;
  const completed = new Set(task.completedStudentIds ?? []);
  return studentUserIds.filter((id) => completed.has(id)).length;
}

export function areAllStudentsCompleteOnTask(
  task: { completedStudentIds?: readonly string[] },
  studentUserIds: readonly string[],
): boolean {
  return (
    studentUserIds.length > 0 &&
    countTaskCompletionsForStudents(task, studentUserIds) === studentUserIds.length
  );
}

/** Active (non-archived) tasks split by whether every selected student is complete. */
export function partitionActiveTasksByStudentCompletion<
  T extends { archivedAt?: number; completedStudentIds?: readonly string[] },
>(tasks: readonly T[], studentUserIds: readonly string[]): { incomplete: T[]; completed: T[] } {
  const incomplete: T[] = [];
  const completed: T[] = [];
  for (const task of tasks) {
    if (isTaskArchived(task)) continue;
    if (areAllStudentsCompleteOnTask(task, studentUserIds)) {
      completed.push(task);
    } else {
      incomplete.push(task);
    }
  }
  return { incomplete, completed };
}

export function isPersonalTaskDetail(detail: TaskDetail): detail is TaskDetailPersonal {
  return detail.scope === "personal";
}

/** True when the task due date/time is before now (date-only: before today). */
export function isTaskPastDue(dueDateKey: string | undefined, now: Date = new Date()): boolean {
  return isPastDue(dueDateKey, now);
}

export {
  MAX_TASK_ATTACHMENTS,
  MAX_TASK_DESCRIPTION_LENGTH,
  MAX_TASK_NAME_LENGTH,
  MAX_TASK_PROCEDURE_STEP_LENGTH,
  MAX_TASK_PROCEDURE_STEPS,
  MAX_TASK_RESOURCES,
} from "../../../convex/lib/tasks/taskSchema";

export function computeStudentsDoneWithAllTasks<
  T extends { archivedAt?: number; completedStudentIds?: readonly string[] },
>(
  tasks: readonly T[],
  students: ReadonlyArray<{ userId: string }>,
): {
  done: Array<{ userId: string; completed: number; total: number }>;
  remaining: Array<{ userId: string; completed: number; total: number }>;
} {
  const active = tasks.filter((task) => task.archivedAt === undefined);
  const total = active.length;
  const done: Array<{ userId: string; completed: number; total: number }> = [];
  const remaining: Array<{ userId: string; completed: number; total: number }> = [];
  for (const student of students) {
    const completed = active.filter((task) =>
      (task.completedStudentIds ?? []).includes(student.userId),
    ).length;
    const row = { userId: student.userId, completed, total };
    if (total > 0 && completed >= total) done.push(row);
    else remaining.push(row);
  }
  return { done, remaining };
}

export type StudentTaskProgressRow = {
  userId: string;
  completed: number;
  total: number;
};

/** Roster-ordered progress for every student on unarchived tasks. */
export function listStudentTaskProgress<
  T extends { archivedAt?: number; completedStudentIds?: readonly string[] },
>(tasks: readonly T[], students: ReadonlyArray<{ userId: string }>): StudentTaskProgressRow[] {
  const { done, remaining } = computeStudentsDoneWithAllTasks(tasks, students);
  const byUser = new Map([...done, ...remaining].map((row) => [row.userId, row] as const));
  return students.flatMap((student) => {
    const row = byUser.get(student.userId);
    return row ? [row] : [];
  });
}

export type TaskSortDirection = "asc" | "desc";

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

export type TaskTopLevelItem =
  | { type: "assignment"; id: string; group: TaskAssignmentGroup }
  | { type: "task"; id: string; task: TaskListItem };

export type TaskReorderItem = TaskTopLevelRef<Id<"tasks">, Id<"assignments">>;

/** Mixed top-level sequence: assignment folders and ungrouped tasks in teacher order. */
export function buildTaskTopLevelItems(tasks: readonly TaskListItem[]): TaskTopLevelItem[] {
  const sorted = [...tasks].sort(compareTaskSortOrder);
  const items: TaskTopLevelItem[] = [];
  const folderTasks = new Map<string, TaskListItem[]>();

  for (const task of sorted) {
    if (task.assignmentId && task.assignmentName) {
      const existing = folderTasks.get(task.assignmentId);
      if (existing) {
        existing.push(task);
        continue;
      }
      folderTasks.set(task.assignmentId, [task]);
      items.push({
        type: "assignment",
        id: `assignment:${task.assignmentId}`,
        group: {
          assignmentId: task.assignmentId,
          assignmentName: task.assignmentName,
          ...(task.assignmentSubject ? { assignmentSubject: task.assignmentSubject } : {}),
          ...(task.assignmentUnit ? { assignmentUnit: task.assignmentUnit } : {}),
          tasks: [],
        },
      });
      continue;
    }
    items.push({
      type: "task",
      id: `task:${task._id}`,
      task,
    });
  }

  for (const item of items) {
    if (item.type !== "assignment") continue;
    item.group.tasks = sortTasksByProcedureStep(folderTasks.get(item.group.assignmentId) ?? []);
  }

  return items;
}

export function toTaskReorderItems(items: readonly TaskTopLevelItem[]): TaskReorderItem[] {
  return items.map((item) =>
    item.type === "task"
      ? { type: "task", taskId: item.task._id }
      : { type: "assignment", assignmentId: item.group.assignmentId },
  );
}

export function applyTaskTopLevelOrder(
  tasks: TaskList,
  items: readonly TaskReorderItem[],
): TaskList {
  const orderByTaskId = new Map<string, number>();
  items.forEach((item, index) => {
    if (item.type === "task") {
      orderByTaskId.set(item.taskId, index);
      return;
    }
    for (const task of tasks) {
      if (task.assignmentId === item.assignmentId && task.archivedAt === undefined) {
        orderByTaskId.set(task._id, index);
      }
    }
  });
  return tasks.map((task) => {
    const sortOrder = orderByTaskId.get(task._id);
    return sortOrder === undefined ? task : { ...task, sortOrder };
  });
}

/** Partition tasks into assignment folders + ungrouped tasks (teacher order). */
export function groupTasksByAssignment(tasks: readonly TaskListItem[]): {
  groups: TaskAssignmentGroup[];
  ungrouped: TaskListItem[];
} {
  const items = buildTaskTopLevelItems(tasks);
  const groups: TaskAssignmentGroup[] = [];
  const ungrouped: TaskListItem[] = [];
  for (const item of items) {
    if (item.type === "assignment") groups.push(item.group);
    else ungrouped.push(item.task);
  }
  return { groups, ungrouped };
}

/** Split assignment folders by whether every selected student is complete on every task. */
export function partitionAssignmentGroupsByCompletion(
  groups: readonly TaskAssignmentGroup[],
  studentUserIds: readonly string[],
): { incompleteGroups: TaskAssignmentGroup[]; completedGroups: TaskAssignmentGroup[] } {
  const incompleteGroups: TaskAssignmentGroup[] = [];
  const completedGroups: TaskAssignmentGroup[] = [];
  for (const group of groups) {
    const { incomplete } = partitionActiveTasksByStudentCompletion(group.tasks, studentUserIds);
    if (incomplete.length > 0) incompleteGroups.push(group);
    else completedGroups.push(group);
  }
  return { incompleteGroups, completedGroups };
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
