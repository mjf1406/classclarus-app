import { z } from "zod";

export const FEEDBACK_TYPES = ["bug", "feature", "concern", "other"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_SEVERITIES = ["low", "medium", "high"] as const;
export type FeedbackSeverity = (typeof FEEDBACK_SEVERITIES)[number];

export const FEEDBACK_IMPORTANCES = ["nice", "important", "critical"] as const;
export type FeedbackImportance = (typeof FEEDBACK_IMPORTANCES)[number];

export const MAX_FEEDBACK_TITLE_LENGTH = 120;
export const MAX_FEEDBACK_BODY_LENGTH = 4000;
export const MAX_FEEDBACK_FIELD_LENGTH = 2000;
export const MAX_FEEDBACK_ATTACHMENTS = 3;

export type FeedbackFormMessages = {
  titleRequired: string;
  titleTooLong: string;
  bodyRequired: string;
  bodyTooLong: string;
  severityRequired: string;
};

export function createFeedbackFormSchema(messages: FeedbackFormMessages) {
  return z
    .object({
      type: z.enum(FEEDBACK_TYPES),
      title: z
        .string()
        .trim()
        .min(1, messages.titleRequired)
        .max(MAX_FEEDBACK_TITLE_LENGTH, messages.titleTooLong),
      body: z
        .string()
        .trim()
        .min(1, messages.bodyRequired)
        .max(MAX_FEEDBACK_BODY_LENGTH, messages.bodyTooLong),
      // Prefer plain strings (not `.default()`) so input/output match TanStack Form values.
      stepsToReproduce: z.string().max(MAX_FEEDBACK_FIELD_LENGTH),
      expected: z.string().max(MAX_FEEDBACK_FIELD_LENGTH),
      actual: z.string().max(MAX_FEEDBACK_FIELD_LENGTH),
      severity: z.enum(FEEDBACK_SEVERITIES).optional(),
      useCase: z.string().max(MAX_FEEDBACK_FIELD_LENGTH),
      proposedSolution: z.string().max(MAX_FEEDBACK_FIELD_LENGTH),
      importance: z.enum(FEEDBACK_IMPORTANCES).optional(),
      impact: z.string().max(MAX_FEEDBACK_FIELD_LENGTH),
      wantReply: z.boolean(),
    })
    .superRefine((value, ctx) => {
      if (value.type === "bug" && !value.severity) {
        ctx.addIssue({
          code: "custom",
          path: ["severity"],
          message: messages.severityRequired,
        });
      }
    });
}

export type FeedbackFormValues = z.infer<ReturnType<typeof createFeedbackFormSchema>>;

export function emptyFeedbackFormValues(): FeedbackFormValues {
  return {
    type: "bug",
    title: "",
    body: "",
    stepsToReproduce: "",
    expected: "",
    actual: "",
    severity: "medium",
    useCase: "",
    proposedSolution: "",
    importance: "nice",
    impact: "",
    wantReply: false,
  };
}

/** Strip unused type-specific fields before submit. */
export function feedbackArgsFromForm(values: FeedbackFormValues) {
  const base = {
    type: values.type,
    title: values.title.trim(),
    body: values.body.trim(),
    wantReply: values.wantReply,
  };
  if (values.type === "bug") {
    return {
      ...base,
      stepsToReproduce: values.stepsToReproduce.trim() || undefined,
      expected: values.expected.trim() || undefined,
      actual: values.actual.trim() || undefined,
      severity: values.severity,
    };
  }
  if (values.type === "feature") {
    return {
      ...base,
      useCase: values.useCase.trim() || undefined,
      proposedSolution: values.proposedSolution.trim() || undefined,
      importance: values.importance,
    };
  }
  if (values.type === "concern") {
    return {
      ...base,
      impact: values.impact.trim() || undefined,
    };
  }
  return base;
}
