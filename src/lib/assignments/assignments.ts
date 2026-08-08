import type { FunctionReturnType } from "convex/server";

import { EMPTY_ANNOUNCEMENT_BODY_JSON } from "@/lib/announcements/tiptapExtensions";
import { coerceDueDateKeyForInput, isPastDue, normalizeDueDateKey } from "@/lib/dueDate/dueDateKey";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export type AssignmentListItem = FunctionReturnType<typeof api.assignments.list>[number];
export type AssignmentList = FunctionReturnType<typeof api.assignments.list>;
export type AssignmentDetail = NonNullable<FunctionReturnType<typeof api.assignments.get>>;
export type AssignmentDetailClass = Extract<AssignmentDetail, { scope: "class" }>;
export type AssignmentDetailPersonal = Extract<AssignmentDetail, { scope: "personal" }>;
export type AssignmentStudentLink = AssignmentDetailClass["links"][number];
export type AssignmentSection = NonNullable<AssignmentListItem["sections"]>[number];
export type AssignmentProcedureStep = AssignmentListItem["procedureSteps"][number];

export function isClassAssignmentDetail(detail: AssignmentDetail): detail is AssignmentDetailClass {
  return detail.scope === "class";
}

export function isPersonalAssignmentDetail(
  detail: AssignmentDetail,
): detail is AssignmentDetailPersonal {
  return detail.scope === "personal";
}

/** True when the assignment due date/time is before now (date-only: before today). */
export function isAssignmentPastDue(
  dueDateKey: string | undefined,
  now: Date = new Date(),
): boolean {
  return isPastDue(dueDateKey, now);
}

export const MAX_ASSIGNMENT_NAME_LENGTH = 100;
export const MAX_ASSIGNMENT_SUBJECT_LENGTH = 100;
export const MAX_ASSIGNMENT_UNIT_LENGTH = 100;
export const MAX_ASSIGNMENT_SECTION_NAME_LENGTH = 100;
export const MAX_ASSIGNMENT_LEVEL_DESCRIPTION_LENGTH = 500;
export const MAX_ASSIGNMENT_PROCEDURE_STEP_LENGTH = 500;
export const MAX_ASSIGNMENT_LINK_URL_LENGTH = 2000;
export const MAX_ASSIGNMENT_LINK_LABEL_LENGTH = 100;
export const MAX_ASSIGNMENT_SECTIONS = 30;
export const MAX_ASSIGNMENT_LEVELS_PER_SECTION = 20;
export const MAX_ASSIGNMENT_ITEMS_PER_SECTION = 30;
export const MAX_ASSIGNMENT_PROCEDURE_STEPS = 50;
export const MAX_ASSIGNMENT_EXPECTATIONS = 20;

export const EMPTY_ASSIGNMENT_INSTRUCTIONS_JSON = EMPTY_ANNOUNCEMENT_BODY_JSON;

export type AssignmentSortKey = "name" | "created" | "updated" | "due";
export type AssignmentSortDirection = "asc" | "desc";

export type AssignmentScoringMode = "total" | "sections";
export type AssignmentSectionType = "points" | "rubricLevels" | "rubricCheckboxes";

export type AssignmentFormRubricEntry = {
  key: string;
  description: string;
  points: number;
};

export type AssignmentFormSection = {
  key: string;
  name: string;
  type: AssignmentSectionType;
  maxPoints: number;
  levels: AssignmentFormRubricEntry[];
  items: AssignmentFormRubricEntry[];
};

export type AssignmentFormProcedureStep = {
  key: string;
  body: string;
  addAsTask: boolean;
  taskId?: Id<"tasks">;
};

export type AssignmentFormValues = {
  name: string;
  subject: string;
  unit: string;
  dueDateKey: string;
  instructionsJson: string;
  scoringMode: AssignmentScoringMode;
  totalPoints: number;
  sections: AssignmentFormSection[];
  procedureSteps: AssignmentFormProcedureStep[];
  expectationIds: Array<Id<"expectations">>;
};

export function createEmptyRubricEntry(): AssignmentFormRubricEntry {
  return {
    key: crypto.randomUUID(),
    description: "",
    points: 0,
  };
}

export function createEmptySection(type: AssignmentSectionType = "points"): AssignmentFormSection {
  return {
    key: crypto.randomUUID(),
    name: "",
    type,
    maxPoints: 10,
    levels: [createEmptyRubricEntry()],
    items: [createEmptyRubricEntry()],
  };
}

export function createEmptyProcedureStep(): AssignmentFormProcedureStep {
  return {
    key: crypto.randomUUID(),
    body: "",
    addAsTask: false,
  };
}

export function emptyAssignmentFormValues(): AssignmentFormValues {
  return {
    name: "",
    subject: "",
    unit: "",
    dueDateKey: "",
    instructionsJson: EMPTY_ASSIGNMENT_INSTRUCTIONS_JSON,
    scoringMode: "total",
    totalPoints: 100,
    sections: [],
    procedureSteps: [],
    expectationIds: [],
  };
}

export function assignmentFormValuesFromDetail(
  detail: AssignmentDetail | AssignmentListItem,
): AssignmentFormValues {
  return {
    name: detail.name,
    subject: detail.subject ?? "",
    unit: detail.unit ?? "",
    dueDateKey: coerceDueDateKeyForInput(detail.dueDateKey),
    instructionsJson: detail.instructionsJson ?? EMPTY_ASSIGNMENT_INSTRUCTIONS_JSON,
    scoringMode: detail.scoringMode,
    totalPoints: detail.totalPoints ?? 100,
    sections: (detail.sections ?? []).map((section) => ({
      key: section.key,
      name: section.name,
      type: section.type,
      maxPoints: section.maxPoints ?? 10,
      levels: (section.levels ?? [createEmptyRubricEntry()]).map((level) => ({
        key: level.key,
        description: level.description,
        points: level.points,
      })),
      items: (section.items ?? [createEmptyRubricEntry()]).map((item) => ({
        key: item.key,
        description: item.description,
        points: item.points,
      })),
    })),
    procedureSteps: detail.procedureSteps.map((step) => ({
      key: step.key,
      body: step.body,
      addAsTask: step.addAsTask,
      ...(step.taskId ? { taskId: step.taskId } : {}),
    })),
    expectationIds: [...detail.expectationIds],
  };
}

export type AssignmentMutationPayload = {
  name: string;
  subject?: string;
  unit?: string;
  dueDateKey?: string;
  instructionsJson?: string;
  scoringMode: AssignmentScoringMode;
  totalPoints?: number;
  sections?: Array<{
    key: string;
    name: string;
    type: AssignmentSectionType;
    maxPoints?: number;
    levels?: AssignmentFormRubricEntry[];
    items?: AssignmentFormRubricEntry[];
  }>;
  procedureSteps: Array<{
    key: string;
    body: string;
    addAsTask: boolean;
    taskId?: Id<"tasks">;
  }>;
  expectationIds: Array<Id<"expectations">>;
};

export function assignmentMutationPayloadFromForm(
  values: AssignmentFormValues,
): AssignmentMutationPayload {
  const subject = values.subject.trim() || undefined;
  const unit = values.unit.trim() || undefined;
  const trimmedDue = values.dueDateKey.trim();
  const dueDateKey = trimmedDue ? (normalizeDueDateKey(trimmedDue) ?? undefined) : undefined;
  const instructionsJson = values.instructionsJson.trim() || undefined;

  const base = {
    name: values.name.trim(),
    ...(subject ? { subject } : {}),
    ...(unit ? { unit } : {}),
    ...(dueDateKey ? { dueDateKey } : {}),
    ...(instructionsJson ? { instructionsJson } : {}),
    procedureSteps: values.procedureSteps.map((step) => ({
      key: step.key,
      body: step.body.trim(),
      addAsTask: step.addAsTask,
      ...(step.taskId ? { taskId: step.taskId } : {}),
    })),
    expectationIds: values.expectationIds,
  };

  if (values.scoringMode === "total") {
    return {
      ...base,
      scoringMode: "total",
      totalPoints: values.totalPoints,
    };
  }

  return {
    ...base,
    scoringMode: "sections",
    sections: values.sections.map((section) => {
      if (section.type === "points") {
        return {
          key: section.key,
          name: section.name.trim(),
          type: "points" as const,
          maxPoints: section.maxPoints,
        };
      }
      if (section.type === "rubricLevels") {
        return {
          key: section.key,
          name: section.name.trim(),
          type: "rubricLevels" as const,
          levels: section.levels.map((level) => ({
            key: level.key,
            description: level.description.trim(),
            points: level.points,
          })),
        };
      }
      return {
        key: section.key,
        name: section.name.trim(),
        type: "rubricCheckboxes" as const,
        items: section.items.map((item) => ({
          key: item.key,
          description: item.description.trim(),
          points: item.points,
        })),
      };
    }),
  };
}

export function compareAssignments(
  a: AssignmentListItem,
  b: AssignmentListItem,
  sortKey: AssignmentSortKey,
  direction: AssignmentSortDirection,
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
    case "due": {
      const aDue = a.dueDateKey ?? "";
      const bDue = b.dueDateKey ?? "";
      if (aDue !== bDue) {
        if (!aDue) return 1;
        if (!bDue) return -1;
        return aDue.localeCompare(bDue) * dir;
      }
      return (a.updatedAt - b.updatedAt) * dir;
    }
  }
}

export function sortAssignments(
  assignments: readonly AssignmentListItem[],
  sortKey: AssignmentSortKey,
  direction: AssignmentSortDirection,
): AssignmentListItem[] {
  return [...assignments].sort((a, b) => compareAssignments(a, b, sortKey, direction));
}

export function nextAssignmentSortState(
  currentKey: AssignmentSortKey,
  currentDirection: AssignmentSortDirection,
  nextKey: AssignmentSortKey,
): { sortKey: AssignmentSortKey; sortDirection: AssignmentSortDirection } {
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

export function filterAssignmentsByName(
  assignments: readonly AssignmentListItem[],
  query: string,
): AssignmentListItem[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [...assignments];
  return assignments.filter((assignment) => assignment.name.toLowerCase().includes(trimmed));
}

export const UNSET_FILTER = "__unset__";

export function filterAssignmentsBySubjectUnit(
  assignments: readonly AssignmentListItem[],
  subject: string | null,
  unit: string | null,
): AssignmentListItem[] {
  return assignments.filter((assignment) => {
    if (subject !== null) {
      const value = assignment.subject?.trim();
      if (subject === UNSET_FILTER) {
        if (value) return false;
      } else if (value !== subject) {
        return false;
      }
    }
    if (unit !== null) {
      const value = assignment.unit?.trim();
      if (unit === UNSET_FILTER) {
        if (value) return false;
      } else if (value !== unit) {
        return false;
      }
    }
    return true;
  });
}

function distinctOptionalLabels(
  assignments: readonly AssignmentListItem[],
  field: "subject" | "unit",
): string[] {
  const set = new Set<string>();
  let hasUnset = false;
  for (const assignment of assignments) {
    const value = assignment[field]?.trim();
    if (value) set.add(value);
    else hasUnset = true;
  }
  const values = [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return hasUnset ? [...values, UNSET_FILTER] : values;
}

export function distinctSubjects(assignments: readonly AssignmentListItem[]): string[] {
  return distinctOptionalLabels(assignments, "subject");
}

export function distinctUnits(assignments: readonly AssignmentListItem[]): string[] {
  return distinctOptionalLabels(assignments, "unit");
}
