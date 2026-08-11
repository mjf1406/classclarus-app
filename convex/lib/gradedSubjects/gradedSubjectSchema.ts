import { z } from "zod";

export const MAX_GRADED_SUBJECT_NAME_LENGTH = 100;
export const MAX_GRADED_SUBJECT_ICON_LENGTH = 120;
export const WEIGHT_SUM_EPSILON = 0.001;

export type GradedSubjectMessages = {
  nameRequired: string;
  nameTooLong: string;
  iconTooLong: string;
  gradeScaleRequired: string;
  itemsRequired: string;
  weightOutOfRange: string;
  weightsMustSumToOne: string;
  duplicateItem: string;
};

export const GRADED_SUBJECT_MESSAGES_EN: GradedSubjectMessages = {
  nameRequired: "Name is required",
  nameTooLong: `Name must be at most ${MAX_GRADED_SUBJECT_NAME_LENGTH} characters`,
  iconTooLong: `Icon must be at most ${MAX_GRADED_SUBJECT_ICON_LENGTH} characters`,
  gradeScaleRequired: "Grade scale is required",
  itemsRequired: "Select at least one assignment or section",
  weightOutOfRange: "Weight must be between 0 and 1",
  weightsMustSumToOne: "Weights must sum to 100%",
  duplicateItem: "Each assignment or section can only be selected once",
};

export type GradedSubjectItemInput = {
  assignmentId: string;
  sectionKey?: string;
  weight: number;
};

export type GradedSubjectUiItemInput = {
  assignmentId: string;
  sectionKey?: string;
  weightPercent: number;
};

function itemKey(item: Pick<GradedSubjectItemInput, "assignmentId" | "sectionKey">): string {
  return `${item.assignmentId}:${item.sectionKey ?? ""}`;
}

function refineUniqueItems(
  items: Array<Pick<GradedSubjectItemInput, "assignmentId" | "sectionKey">>,
  messages: GradedSubjectMessages,
  ctx: z.RefinementCtx,
) {
  const seen = new Set<string>();
  for (const item of items) {
    const key = itemKey(item);
    if (seen.has(key)) {
      ctx.addIssue({
        code: "custom",
        message: messages.duplicateItem,
      });
      return;
    }
    seen.add(key);
  }
}

function refineWeightsSum(
  sum: number,
  target: number,
  epsilon: number,
  messages: GradedSubjectMessages,
  ctx: z.RefinementCtx,
) {
  if (Math.abs(sum - target) > epsilon) {
    ctx.addIssue({
      code: "custom",
      message: messages.weightsMustSumToOne,
    });
  }
}

export function createGradedSubjectItemSchema(messages: GradedSubjectMessages) {
  return z.object({
    assignmentId: z.string().min(1),
    sectionKey: z.string().optional(),
    weight: z
      .number()
      .refine((value) => Number.isFinite(value), { message: messages.weightOutOfRange })
      .refine((value) => value >= 0 && value <= 1, { message: messages.weightOutOfRange }),
  });
}

export function createGradedSubjectItemsSchema(messages: GradedSubjectMessages) {
  const itemSchema = createGradedSubjectItemSchema(messages);
  return z
    .array(itemSchema)
    .min(1, messages.itemsRequired)
    .superRefine((items, ctx) => {
      const sum = items.reduce((total, item) => total + item.weight, 0);
      refineWeightsSum(sum, 1, WEIGHT_SUM_EPSILON, messages, ctx);
      refineUniqueItems(items, messages, ctx);
    });
}

export function createGradedSubjectUiItemSchema(messages: GradedSubjectMessages) {
  return z.object({
    assignmentId: z.string().min(1),
    sectionKey: z.string().optional(),
    weightPercent: z
      .number()
      .refine((value) => Number.isFinite(value), { message: messages.weightOutOfRange })
      .refine((value) => value >= 0 && value <= 100, { message: messages.weightOutOfRange }),
  });
}

export function createGradedSubjectUiItemsSchema(messages: GradedSubjectMessages) {
  const itemSchema = createGradedSubjectUiItemSchema(messages);
  return z
    .array(itemSchema)
    .min(1, messages.itemsRequired)
    .superRefine((items, ctx) => {
      const sum = items.reduce((total, item) => total + item.weightPercent, 0);
      refineWeightsSum(sum, 100, WEIGHT_SUM_EPSILON * 100, messages, ctx);
      refineUniqueItems(items, messages, ctx);
    });
}

export function createGradedSubjectNameSchema(messages: GradedSubjectMessages) {
  return z
    .string()
    .trim()
    .min(1, messages.nameRequired)
    .max(MAX_GRADED_SUBJECT_NAME_LENGTH, messages.nameTooLong);
}

export function createGradedSubjectIconSchema(messages: GradedSubjectMessages) {
  return z
    .string()
    .trim()
    .max(MAX_GRADED_SUBJECT_ICON_LENGTH, messages.iconTooLong)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));
}

/** Icon as a plain string for TanStack Form defaults (empty string allowed). */
export function createGradedSubjectUiIconSchema(messages: GradedSubjectMessages) {
  return z.string().trim().max(MAX_GRADED_SUBJECT_ICON_LENGTH, messages.iconTooLong);
}

/** Server / mutation payload shape (`weight` 0–1). */
export function createGradedSubjectFormSchema(messages: GradedSubjectMessages) {
  return z.object({
    name: createGradedSubjectNameSchema(messages),
    icon: createGradedSubjectIconSchema(messages),
    gradeScaleId: z.string().min(1, messages.gradeScaleRequired),
    items: createGradedSubjectItemsSchema(messages),
  });
}

/** Client form shape (`weightPercent` 0–100, icon always a string). */
export function createGradedSubjectUiFormSchema(messages: GradedSubjectMessages) {
  return z.object({
    name: createGradedSubjectNameSchema(messages),
    icon: createGradedSubjectUiIconSchema(messages),
    gradeScaleId: z.string().min(1, messages.gradeScaleRequired),
    items: createGradedSubjectUiItemsSchema(messages),
  });
}

export const gradedSubjectFormSchemaEn = createGradedSubjectFormSchema(GRADED_SUBJECT_MESSAGES_EN);
