import { z } from "zod";

export const MAX_GRADE_SCALE_NAME_LENGTH = 100;
export const MAX_GRADE_SCALE_LABEL_LENGTH = 40;
export const MAX_GRADE_SCALE_LEVELS = 20;

export type GradeScaleLevelMessages = {
  labelRequired: string;
  labelTooLong: string;
  percentInvalid: string;
  percentOutOfRange: string;
  minExceedsMax: (label: string) => string;
  levelsRequired: string;
  levelsTooMany: string;
  highestMustReach100: string;
  lowestMustStartAt0: string;
  bandsMustConnect: (expectedMin: number, afterLabel: string) => string;
};

export type GradeScaleNameMessages = {
  nameRequired: string;
  nameTooLong: string;
};

/** English messages used by the Convex server. */
export const GRADE_SCALE_LEVEL_MESSAGES_EN: GradeScaleLevelMessages = {
  labelRequired: "Grade label is required",
  labelTooLong: `Grade label must be at most ${MAX_GRADE_SCALE_LABEL_LENGTH} characters`,
  percentInvalid: "Percent must be a number",
  percentOutOfRange: "Percent must be between 0 and 100",
  minExceedsMax: (label) => `Grade "${label}" minimum cannot exceed maximum`,
  levelsRequired: "At least one grade level is required",
  levelsTooMany: `At most ${MAX_GRADE_SCALE_LEVELS} grade levels are allowed`,
  highestMustReach100: "The highest grade must reach 100%",
  lowestMustStartAt0: "The lowest grade must start at 0%",
  bandsMustConnect: (expectedMin, afterLabel) =>
    `Grade bands must connect without gaps or overlaps (expected ${expectedMin}% after "${afterLabel}")`,
};

export const GRADE_SCALE_NAME_MESSAGES_EN: GradeScaleNameMessages = {
  nameRequired: "Name is required",
  nameTooLong: `Name must be at most ${MAX_GRADE_SCALE_NAME_LENGTH} characters`,
};

const percentSchema = (messages: GradeScaleLevelMessages) =>
  z
    .number({ error: messages.percentInvalid })
    .refine((value) => Number.isFinite(value), { message: messages.percentInvalid })
    .transform((value) => Math.round(value))
    .refine((value) => value >= 0 && value <= 100, { message: messages.percentOutOfRange });

export function createGradeScaleLevelSchema(messages: GradeScaleLevelMessages) {
  return z
    .object({
      key: z.string().optional(),
      label: z
        .string()
        .trim()
        .min(1, messages.labelRequired)
        .max(MAX_GRADE_SCALE_LABEL_LENGTH, messages.labelTooLong),
      minPercent: percentSchema(messages),
      maxPercent: percentSchema(messages),
    })
    .superRefine((level, ctx) => {
      if (level.minPercent > level.maxPercent) {
        ctx.addIssue({
          code: "custom",
          message: messages.minExceedsMax(level.label),
          path: ["minPercent"],
        });
      }
    });
}

export function createGradeScaleLevelsSchema(messages: GradeScaleLevelMessages) {
  const levelSchema = createGradeScaleLevelSchema(messages);
  return z
    .array(levelSchema)
    .min(1, messages.levelsRequired)
    .max(MAX_GRADE_SCALE_LEVELS, messages.levelsTooMany)
    .superRefine((levels, ctx) => {
      const sorted = [...levels].sort((a, b) => b.minPercent - a.minPercent);
      const highest = sorted[0];
      const lowest = sorted[sorted.length - 1];

      if (highest && highest.maxPercent !== 100) {
        ctx.addIssue({
          code: "custom",
          message: messages.highestMustReach100,
        });
      }
      if (lowest && lowest.minPercent !== 0) {
        ctx.addIssue({
          code: "custom",
          message: messages.lowestMustStartAt0,
        });
      }

      for (let i = 0; i < sorted.length - 1; i += 1) {
        const higher = sorted[i];
        const lower = sorted[i + 1];
        if (!higher || !lower) continue;
        if (lower.maxPercent + 1 !== higher.minPercent) {
          ctx.addIssue({
            code: "custom",
            message: messages.bandsMustConnect(lower.maxPercent + 1, lower.label),
          });
          break;
        }
      }
    });
}

export function createGradeScaleNameSchema(messages: GradeScaleNameMessages) {
  return z
    .string()
    .trim()
    .min(1, messages.nameRequired)
    .max(MAX_GRADE_SCALE_NAME_LENGTH, messages.nameTooLong);
}

export function createGradeScaleFormSchema(
  nameMessages: GradeScaleNameMessages,
  levelMessages: GradeScaleLevelMessages,
) {
  return z.object({
    name: createGradeScaleNameSchema(nameMessages),
    levels: createGradeScaleLevelsSchema(levelMessages),
  });
}

export const gradeScaleLevelsSchemaEn = createGradeScaleLevelsSchema(GRADE_SCALE_LEVEL_MESSAGES_EN);
export const gradeScaleNameSchemaEn = createGradeScaleNameSchema(GRADE_SCALE_NAME_MESSAGES_EN);
export const gradeScaleFormSchemaEn = createGradeScaleFormSchema(
  GRADE_SCALE_NAME_MESSAGES_EN,
  GRADE_SCALE_LEVEL_MESSAGES_EN,
);
