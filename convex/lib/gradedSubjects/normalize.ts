import {
  createGradedSubjectFormSchema,
  GRADED_SUBJECT_MESSAGES_EN,
  type GradedSubjectItemInput,
} from "./gradedSubjectSchema.js";

export type NormalizedGradedSubjectItem = {
  assignmentId: string;
  sectionKey?: string;
  weight: number;
};

export type NormalizedGradedSubjectInput = {
  name: string;
  icon?: string;
  gradeScaleId: string;
  items: NormalizedGradedSubjectItem[];
};

export function normalizeGradedSubjectName(name: string): string {
  const parsed = createGradedSubjectFormSchema(GRADED_SUBJECT_MESSAGES_EN).shape.name.safeParse(
    name,
  );
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid name");
  }
  return parsed.data;
}

export function normalizeGradedSubjectItems(
  items: GradedSubjectItemInput[],
): NormalizedGradedSubjectItem[] {
  const normalized = items.map((item) => ({
    assignmentId: item.assignmentId,
    sectionKey: item.sectionKey?.trim() || undefined,
    weight: Math.round(item.weight * 1000) / 1000,
  }));

  const parsed = createGradedSubjectFormSchema(GRADED_SUBJECT_MESSAGES_EN).shape.items.safeParse(
    normalized,
  );
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid items");
  }
  return parsed.data;
}

export function normalizeGradedSubjectInput(input: {
  name: string;
  icon?: string;
  gradeScaleId: string;
  items: GradedSubjectItemInput[];
}): NormalizedGradedSubjectInput {
  const parsed = createGradedSubjectFormSchema(GRADED_SUBJECT_MESSAGES_EN).safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  return {
    name: parsed.data.name,
    icon: parsed.data.icon,
    gradeScaleId: parsed.data.gradeScaleId,
    items: parsed.data.items.map((item) => ({
      assignmentId: item.assignmentId,
      sectionKey: item.sectionKey,
      weight: item.weight,
    })),
  };
}
