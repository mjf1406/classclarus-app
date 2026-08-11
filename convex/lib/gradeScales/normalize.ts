import type { GradeScaleLevel } from "./defaults.js";
import { gradeScaleLevelsSchemaEn, gradeScaleNameSchemaEn } from "./gradeScaleSchema.js";

export type GradeScaleLevelInput = {
  key?: string;
  label: string;
  minPercent: number;
  maxPercent: number;
};

export {
  MAX_GRADE_SCALE_LABEL_LENGTH,
  MAX_GRADE_SCALE_LEVELS,
  MAX_GRADE_SCALE_NAME_LENGTH,
} from "./gradeScaleSchema.js";

function slugKey(label: string, index: number): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.length > 0 ? `${base}-${index}` : `level-${index}`;
}

export function normalizeGradeScaleName(name: string): string {
  const parsed = gradeScaleNameSchemaEn.safeParse(name);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Name is required");
  }
  return parsed.data;
}

/**
 * Validates and normalizes grade levels for storage.
 * Bands are sorted high→low; adjacent bands must meet without gaps (e.g. 80–89 then 90–100).
 */
export function normalizeGradeScaleLevels(levels: GradeScaleLevelInput[]): GradeScaleLevel[] {
  const parsed = gradeScaleLevelsSchemaEn.safeParse(levels);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid grade levels");
  }

  const sorted = [...parsed.data]
    .map((level, index) => ({
      key: level.key?.trim() || slugKey(level.label, index),
      label: level.label,
      minPercent: level.minPercent,
      maxPercent: level.maxPercent,
    }))
    .sort((a, b) => b.minPercent - a.minPercent);

  return sorted;
}

/** Map a percentage score to a grade label using half-open interval matching. */
export function resolveGradeLabel(levels: GradeScaleLevel[], percent: number): string | null {
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

/** Format a level band for display, e.g. "80–89%". */
export function formatLevelRange(level: GradeScaleLevel): string {
  return `${level.minPercent}–${level.maxPercent}%`;
}
