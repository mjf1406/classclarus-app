export type TaskSortable = {
  _id: string;
  name: string;
  updatedAt: number;
  sortOrder?: number;
  assignmentId?: string;
  assignmentName?: string;
  archivedAt?: number;
};

export type TaskTopLevelRef<TaskId extends string = string, AssignmentId extends string = string> =
  | { type: "task"; taskId: TaskId }
  | { type: "assignment"; assignmentId: AssignmentId };

export function compareTaskSortOrder(a: TaskSortable, b: TaskSortable): number {
  const aOrder = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
  const bOrder = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
  if (aOrder !== bOrder) return aOrder - bOrder;
  if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export function nextTaskSortOrder(tasks: ReadonlyArray<{ sortOrder?: number }>): number {
  return tasks.reduce((max, task) => Math.max(max, task.sortOrder ?? -1), -1) + 1;
}

export function inheritedAssignmentSortOrder(
  tasks: ReadonlyArray<{ assignmentId?: string; sortOrder?: number }>,
  assignmentId: string,
): number | undefined {
  for (const task of tasks) {
    if (task.assignmentId === assignmentId && task.sortOrder !== undefined) {
      return task.sortOrder;
    }
  }
  return undefined;
}

/** Current list display: assignment folders A–Z, then ungrouped tasks by updated time (newest first). */
export function computeBackfillSortOrders(tasks: readonly TaskSortable[]): Map<string, number> {
  const groups = new Map<string, { name: string; taskIds: string[] }>();
  const ungrouped: TaskSortable[] = [];
  for (const task of tasks) {
    if (task.assignmentId) {
      const existing = groups.get(task.assignmentId);
      if (existing) {
        existing.taskIds.push(task._id);
      } else {
        groups.set(task.assignmentId, {
          name: task.assignmentName ?? "",
          taskIds: [task._id],
        });
      }
    } else {
      ungrouped.push(task);
    }
  }

  const folderEntries = [...groups.entries()].sort((a, b) =>
    a[1].name.localeCompare(b[1].name, undefined, { sensitivity: "base" }),
  );
  ungrouped.sort((a, b) => {
    if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  const result = new Map<string, number>();
  let order = 0;
  for (const [, group] of folderEntries) {
    for (const taskId of group.taskIds) {
      result.set(taskId, order);
    }
    order += 1;
  }
  for (const task of ungrouped) {
    result.set(task._id, order);
    order += 1;
  }
  return result;
}

export function expectedActiveTopLevelItems<T extends TaskSortable>(
  tasks: readonly T[],
): Array<TaskTopLevelRef<T["_id"], NonNullable<T["assignmentId"]>>> {
  const items: Array<TaskTopLevelRef<T["_id"], NonNullable<T["assignmentId"]>>> = [];
  const seenAssignments = new Set<string>();
  for (const task of tasks) {
    if (task.archivedAt !== undefined) continue;
    if (task.assignmentId) {
      if (seenAssignments.has(task.assignmentId)) continue;
      seenAssignments.add(task.assignmentId);
      items.push({ type: "assignment", assignmentId: task.assignmentId });
      continue;
    }
    items.push({ type: "task", taskId: task._id });
  }
  return items;
}

export function validateTopLevelReorder(
  incoming: readonly TaskTopLevelRef[],
  expected: readonly TaskTopLevelRef[],
): string | null {
  if (incoming.length !== expected.length) {
    return "Reorder list must include every active task and assignment folder exactly once";
  }
  const expectedKeys = new Set(expected.map(topLevelKey));
  const seen = new Set<string>();
  for (const item of incoming) {
    const key = topLevelKey(item);
    if (!expectedKeys.has(key)) {
      return "Reorder list contains an unknown task or assignment folder";
    }
    if (seen.has(key)) {
      return "Reorder list has duplicates";
    }
    seen.add(key);
  }
  return null;
}

function topLevelKey(item: TaskTopLevelRef): string {
  return item.type === "task" ? `task:${item.taskId}` : `assignment:${item.assignmentId}`;
}
