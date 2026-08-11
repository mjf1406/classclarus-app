import type { FunctionReturnType } from "convex/server";

import type { AssignmentListItem } from "@/lib/assignments/assignments";
import { assignmentPossiblePoints } from "@/lib/assignments/assignmentScores";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  createGradedSubjectUiFormSchema,
  MAX_GRADED_SUBJECT_ICON_LENGTH,
  MAX_GRADED_SUBJECT_NAME_LENGTH,
  WEIGHT_SUM_EPSILON,
  type GradedSubjectMessages,
} from "../../../convex/lib/gradedSubjects/gradedSubjectSchema.js";

export type GradedSubjectListItem = FunctionReturnType<
  typeof api.gradedSubjects.listForClass
>[number];

export type GradedSubjectDetail = FunctionReturnType<typeof api.gradedSubjects.get>;

/** Fields needed to label items and resolve max points from the assignments list. */
export type GradedSubjectAssignmentRef = Pick<
  AssignmentListItem,
  "_id" | "name" | "scoringMode" | "totalPoints" | "sections"
>;

export type GradedSubjectFormItem = {
  assignmentId: Id<"assignments">;
  sectionKey?: string;
  weightPercent: number;
};

export type GradedSubjectFormValues = {
  name: string;
  icon: string;
  gradeScaleId: Id<"gradeScales"> | "";
  items: GradedSubjectFormItem[];
};

export {
  MAX_GRADED_SUBJECT_ICON_LENGTH,
  MAX_GRADED_SUBJECT_NAME_LENGTH,
  WEIGHT_SUM_EPSILON,
} from "../../../convex/lib/gradedSubjects/gradedSubjectSchema.js";

export function createClientGradedSubjectFormSchema(t: {
  (key: string): string;
  (key: string, options: Record<string, string | number>): string;
}) {
  const messages: GradedSubjectMessages = {
    nameRequired: t("subjectNameRequired"),
    nameTooLong: t("subjectNameTooLong", { max: MAX_GRADED_SUBJECT_NAME_LENGTH }),
    iconTooLong: t("subjectIconTooLong", { max: MAX_GRADED_SUBJECT_ICON_LENGTH }),
    gradeScaleRequired: t("gradeScaleRequired"),
    itemsRequired: t("itemsRequired"),
    weightOutOfRange: t("weightOutOfRange"),
    weightsMustSumToOne: t("weightsMustSumTo100"),
    duplicateItem: t("duplicateItem"),
  };
  return createGradedSubjectUiFormSchema(messages);
}

export function gradedSubjectItemKey(
  item: Pick<GradedSubjectFormItem, "assignmentId" | "sectionKey">,
): string {
  return `${item.assignmentId}:${item.sectionKey ?? ""}`;
}

export function gradedSubjectFormValuesFromDetail(
  detail: GradedSubjectDetail,
): GradedSubjectFormValues {
  return {
    name: detail.name,
    icon: detail.icon ?? "",
    gradeScaleId: detail.gradeScaleId,
    items: detail.items.map((item) => ({
      assignmentId: item.assignmentId,
      sectionKey: item.sectionKey,
      weightPercent: Math.round(item.weight * 10000) / 100,
    })),
  };
}

export function emptyGradedSubjectFormValues(): GradedSubjectFormValues {
  return {
    name: "",
    icon: "",
    gradeScaleId: "",
    items: [],
  };
}

export function gradedSubjectMutationPayloadFromForm(values: GradedSubjectFormValues) {
  const icon = values.icon.trim();
  return {
    name: values.name.trim(),
    ...(icon ? { icon } : { icon: undefined }),
    gradeScaleId: values.gradeScaleId as Id<"gradeScales">,
    items: values.items.map((item) => ({
      assignmentId: item.assignmentId,
      sectionKey: item.sectionKey,
      weight: Math.round(item.weightPercent * 100) / 10000,
    })),
  };
}

export function weightPercentTotal(items: Pick<GradedSubjectFormItem, "weightPercent">[]): number {
  return Math.round(items.reduce((sum, item) => sum + item.weightPercent, 0) * 100) / 100;
}

export function weightsAreValid(items: Pick<GradedSubjectFormItem, "weightPercent">[]): boolean {
  if (items.length === 0) return false;
  const total = weightPercentTotal(items);
  return Math.abs(total - 100) <= WEIGHT_SUM_EPSILON * 100;
}

export function equalSplitWeightPercents(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(10000 / count) / 100;
  const percents = Array.from({ length: count }, () => base);
  const remainder = Math.round((100 - base * count) * 100) / 100;
  if (percents.length > 0) {
    percents[percents.length - 1] =
      Math.round((percents[percents.length - 1]! + remainder) * 100) / 100;
  }
  return percents;
}

/** Proportional split from max points; empty if any value is ≤ 0. Remainder on last item. */
export function pointsSplitWeightPercents(points: number[]): number[] {
  if (points.length === 0) return [];
  if (points.some((value) => !Number.isFinite(value) || value <= 0)) return [];
  const total = points.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];

  const percents = points.map((value, index) => {
    if (index === points.length - 1) return 0;
    return Math.floor((value / total) * 10000) / 100;
  });
  const sumExceptLast = percents.slice(0, -1).reduce((sum, value) => sum + value, 0);
  percents[percents.length - 1] = Math.round((100 - sumExceptLast) * 100) / 100;
  return percents;
}

/**
 * Shared display precision (0–2) for a set of weight percents.
 * Whole numbers → 0; any x.y0 → 1; any finer fraction → 2. Uses the max needed across values.
 */
export function weightPercentDisplayDecimals(values: number[]): number {
  let decimals = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    const hundredths = Math.round(value * 100);
    if (hundredths % 100 === 0) continue;
    if (hundredths % 10 === 0) {
      decimals = Math.max(decimals, 1);
    } else {
      decimals = Math.max(decimals, 2);
    }
  }
  return decimals;
}

/** Format a weight percent; pass `decimals` to keep a group consistent (else derive from value alone). */
export function formatWeightPercent(value: number, decimals?: number): string {
  const dp = decimals ?? weightPercentDisplayDecimals([value]);
  if (!Number.isFinite(value)) return (0).toFixed(dp);
  const factor = 10 ** dp;
  return (Math.round(value * factor) / factor).toFixed(dp);
}

export function describeGradedSubjectItem(
  item: Pick<GradedSubjectFormItem, "assignmentId" | "sectionKey">,
  assignments: GradedSubjectAssignmentRef[],
): string {
  const assignment = assignments.find((row) => row._id === item.assignmentId);
  if (!assignment) return item.sectionKey ?? item.assignmentId;
  if (!item.sectionKey) return assignment.name;
  const section = (assignment.sections ?? []).find((row) => row.key === item.sectionKey);
  return section ? `${assignment.name} · ${section.name}` : assignment.name;
}

export function gradedSubjectItemMaxPoints(
  assignment: Pick<GradedSubjectAssignmentRef, "scoringMode" | "totalPoints" | "sections">,
  sectionKey?: string,
): number {
  if (!sectionKey) {
    return assignmentPossiblePoints(assignment);
  }
  const section = (assignment.sections ?? []).find((row) => row.key === sectionKey);
  if (!section) return 0;
  if (section.type === "points") {
    return section.maxPoints ?? 0;
  }
  if (section.type === "rubricLevels") {
    const levels = section.levels ?? [];
    if (levels.length === 0) return 0;
    return Math.max(...levels.map((level) => level.points));
  }
  return (section.items ?? []).reduce((sum, row) => sum + row.points, 0);
}

export function sectionPointsLabel(
  assignment: Pick<GradedSubjectAssignmentRef, "scoringMode" | "totalPoints" | "sections">,
  sectionKey?: string,
): string {
  return String(gradedSubjectItemMaxPoints(assignment, sectionKey));
}

export const PIE_CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
