import type { GradeScaleSystemKey } from "../../../convex/lib/gradeScales/defaults.js";
import {
  createGradeScaleFormSchema,
  MAX_GRADE_SCALE_LABEL_LENGTH,
  MAX_GRADE_SCALE_LEVELS,
  MAX_GRADE_SCALE_NAME_LENGTH,
  type GradeScaleLevelMessages,
  type GradeScaleNameMessages,
} from "../../../convex/lib/gradeScales/gradeScaleSchema.js";

export type {
  GradeScaleLevel,
  GradeScaleSystemKey,
  SystemGradeScaleSeed,
} from "../../../convex/lib/gradeScales/defaults.js";

export {
  MAX_GRADE_SCALE_LABEL_LENGTH,
  MAX_GRADE_SCALE_LEVELS,
  MAX_GRADE_SCALE_NAME_LENGTH,
} from "../../../convex/lib/gradeScales/gradeScaleSchema.js";

export type GradeScaleListItem = {
  _id: import("../../../convex/_generated/dataModel").Id<"gradeScales">;
  _creationTime: number;
  isSystem: boolean;
  systemKey?: GradeScaleSystemKey;
  name?: string;
  nameKey?: string;
  levels: Array<{
    key: string;
    label: string;
    minPercent: number;
    maxPercent: number;
  }>;
  createdBy?: import("../../../convex/_generated/dataModel").Id<"users">;
  createdAt: number;
  updatedAt: number;
  isHidden: boolean;
};

export type GradeScaleFormLevel = {
  key?: string;
  label: string;
  minPercent: number;
  maxPercent: number;
};

export type GradeScaleFormValues = {
  name: string;
  levels: GradeScaleFormLevel[];
};

export function formatLevelRange(level: { minPercent: number; maxPercent: number }): string {
  return `${level.minPercent}–${level.maxPercent}%`;
}

export function resolveGradeScaleDisplayName(
  scale: Pick<GradeScaleListItem, "isSystem" | "name" | "nameKey">,
  t: (key: string) => string,
  unnamedFallback: string,
): string {
  if (scale.isSystem && scale.nameKey) {
    return t(scale.nameKey);
  }
  const trimmed = scale.name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : unnamedFallback;
}

export function duplicateGradeScaleName(sourceName: string, copySuffix: string): string {
  const base = sourceName.trim();
  const suffix = copySuffix.trim();
  const candidate = `${base} ${suffix}`.trim();
  return candidate.slice(0, MAX_GRADE_SCALE_NAME_LENGTH);
}

export function defaultFormLevels(): GradeScaleFormLevel[] {
  return [{ label: "", minPercent: 0, maxPercent: 100 }];
}

export function levelsFromListItem(
  item: Pick<GradeScaleListItem, "levels">,
): GradeScaleFormLevel[] {
  return item.levels.map((level) => ({
    key: level.key,
    label: level.label,
    minPercent: level.minPercent,
    maxPercent: level.maxPercent,
  }));
}

/** Map a percentage score to a grade label using half-open interval matching. */
export function resolveGradeLabel(
  levels: GradeScaleListItem["levels"],
  percent: number,
): string | null {
  if (!Number.isFinite(percent)) return null;
  const score = Math.max(0, Math.min(100, percent));
  const sorted = [...levels].sort((a, b) => b.minPercent - a.minPercent);
  for (const level of sorted) {
    if (score >= level.minPercent) {
      return level.label;
    }
  }
  return sorted[sorted.length - 1]?.label ?? null;
}

export function createClientGradeScaleFormSchema(t: {
  (key: string): string;
  (key: string, options: Record<string, string | number>): string;
}) {
  const nameMessages: GradeScaleNameMessages = {
    nameRequired: t("nameRequired"),
    nameTooLong: t("nameTooLong", { max: MAX_GRADE_SCALE_NAME_LENGTH }),
  };
  const levelMessages: GradeScaleLevelMessages = {
    labelRequired: t("levelLabelRequired"),
    labelTooLong: t("levelLabelTooLong", { max: MAX_GRADE_SCALE_LABEL_LENGTH }),
    percentInvalid: t("percentInvalid"),
    percentOutOfRange: t("percentOutOfRange"),
    minExceedsMax: (label) => t("levelMinExceedsMax", { label }),
    levelsRequired: t("levelsRequired"),
    levelsTooMany: t("levelsTooMany", { max: MAX_GRADE_SCALE_LEVELS }),
    highestMustReach100: t("levelsHighestMustReach100"),
    lowestMustStartAt0: t("levelsLowestMustStartAt0"),
    bandsMustConnect: (expectedMin, afterLabel) =>
      t("levelsMustConnect", { expectedMin, afterLabel }),
  };
  return createGradeScaleFormSchema(nameMessages, levelMessages);
}
