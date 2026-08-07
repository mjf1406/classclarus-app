import type { FunctionReturnType } from "convex/server";

import { api } from "../../../convex/_generated/api";

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
    return false;
  });
}
