import { extractHashtags } from "@/lib/timetable/sectionItems";
import { emptyAgendaItem, type AgendaItemFormValues } from "@/lib/timetable/timetable";
import { MAX_SECTION_ITEMS } from "../../../convex/lib/timetable/sectionItems";

export const AGENDA_ITEM_LIMIT = MAX_SECTION_ITEMS;

export type AgendaTaskSource = {
  _id: string;
  name: string;
  assignmentId?: string;
  procedureStepNumber?: number;
};

export type AgendaAssignmentSource = {
  _id: string;
  name: string;
};

export type AppendAgendaItemsResult = {
  items: Array<AgendaItemFormValues>;
  added: number;
  skippedDuplicates: number;
  skippedLimit: number;
};

export type AgendaItemKind = "text" | "assignment" | "task";

export function agendaItemKind(
  item: Pick<AgendaItemFormValues, "assignmentId" | "taskId">,
): AgendaItemKind {
  if (item.taskId) return "task";
  if (item.assignmentId) return "assignment";
  return "text";
}

export function createTextAgendaItem(key: string): AgendaItemFormValues {
  return emptyAgendaItem(key);
}

export function createAssignmentAgendaItem(
  key: string,
  assignment: AgendaAssignmentSource,
): AgendaItemFormValues {
  return {
    key,
    text: assignment.name,
    tags: extractHashtags(assignment.name),
    assignmentId: assignment._id,
  };
}

export function createTaskAgendaItem(key: string, task: AgendaTaskSource): AgendaItemFormValues {
  return {
    key,
    text: task.name,
    tags: extractHashtags(task.name),
    taskId: task._id,
  };
}

export function selectTasksForAssignment(
  tasks: ReadonlyArray<AgendaTaskSource>,
  assignmentId: string,
): Array<AgendaTaskSource> {
  return [...tasks.filter((task) => task.assignmentId === assignmentId)].sort((a, b) => {
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

export function excludeExistingTaskIds(
  tasks: ReadonlyArray<AgendaTaskSource>,
  existing: ReadonlyArray<Pick<AgendaItemFormValues, "taskId">>,
): Array<AgendaTaskSource> {
  const used = new Set(
    existing.map((item) => item.taskId).filter((taskId): taskId is string => Boolean(taskId)),
  );
  return tasks.filter((task) => !used.has(task._id));
}

export function appendAgendaItems(
  existing: ReadonlyArray<AgendaItemFormValues>,
  incoming: ReadonlyArray<AgendaItemFormValues>,
  options?: { skipDuplicateTaskIds?: boolean },
): AppendAgendaItemsResult {
  const skipDuplicateTaskIds = options?.skipDuplicateTaskIds ?? true;
  const usedTaskIds = new Set(
    existing.map((item) => item.taskId).filter((taskId): taskId is string => Boolean(taskId)),
  );
  const items = [...existing];
  let added = 0;
  let skippedDuplicates = 0;
  let skippedLimit = 0;

  for (const item of incoming) {
    if (skipDuplicateTaskIds && item.taskId && usedTaskIds.has(item.taskId)) {
      skippedDuplicates += 1;
      continue;
    }
    if (items.length >= AGENDA_ITEM_LIMIT) {
      skippedLimit += 1;
      continue;
    }
    items.push(item);
    added += 1;
    if (item.taskId) usedTaskIds.add(item.taskId);
  }

  return { items, added, skippedDuplicates, skippedLimit };
}

export function findAgendaResourceName(
  resources: ReadonlyArray<{ _id: string; name: string }> | undefined,
  id: string | undefined,
): string | undefined {
  if (!id) return undefined;
  return resources?.find((resource) => String(resource._id) === String(id))?.name;
}

export function agendaNamedLinkLabel(
  resourceName: string | undefined,
  textWhenNoName: string | undefined,
  fallback: string,
): string {
  const name = resourceName?.trim();
  if (name) return name;
  const text = textWhenNoName?.trim();
  if (text) return text;
  return fallback;
}

export function agendaPrefaceText(preface: string | undefined): string | undefined {
  const trimmed = preface?.trim();
  return trimmed ? trimmed : undefined;
}
