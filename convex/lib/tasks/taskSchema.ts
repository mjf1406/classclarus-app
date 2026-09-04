import { z } from "zod";

import {
  MAX_LESSON_RESOURCES,
  MAX_LESSON_URL_LENGTH,
  MAX_RESOURCE_LABEL_LENGTH,
  isValidHttpUrl,
  normalizeLessonResources,
} from "../timetable/timetableSchema.js";

export const MAX_TASK_NAME_LENGTH = 100;
export const MAX_TASK_DESCRIPTION_LENGTH = 500;
export const MAX_TASK_ATTACHMENTS = 5;
export const MAX_TASK_PROCEDURE_STEPS = 50;
export const MAX_TASK_PROCEDURE_STEP_LENGTH = 500;
export const MAX_TASK_RESOURCES = MAX_LESSON_RESOURCES;
export const MAX_TASK_RESOURCE_URL_LENGTH = MAX_LESSON_URL_LENGTH;
export const MAX_TASK_RESOURCE_LABEL_LENGTH = MAX_RESOURCE_LABEL_LENGTH;

export type TaskProcedureStep = {
  key: string;
  body: string;
};

export type TaskResource = {
  key: string;
  url: string;
  label?: string;
};

export type TaskFormMessages = {
  nameRequired: string;
  nameTooLong: string;
  descriptionTooLong: string;
  attachmentsTooMany: string;
  procedureStepRequired: string;
  procedureStepTooLong: string;
  procedureStepsTooMany: string;
  resourceUrlInvalid: string;
  resourcesTooMany: string;
  resourceLabelTooLong: string;
};

/** English messages used by the Convex server. */
export const TASK_FORM_MESSAGES_EN: TaskFormMessages = {
  nameRequired: "Name is required",
  nameTooLong: `Name must be at most ${MAX_TASK_NAME_LENGTH} characters`,
  descriptionTooLong: `Description must be at most ${MAX_TASK_DESCRIPTION_LENGTH} characters`,
  attachmentsTooMany: `At most ${MAX_TASK_ATTACHMENTS} attachments allowed`,
  procedureStepRequired: "Procedure step text is required",
  procedureStepTooLong: `Procedure step must be at most ${MAX_TASK_PROCEDURE_STEP_LENGTH} characters`,
  procedureStepsTooMany: `At most ${MAX_TASK_PROCEDURE_STEPS} procedure steps allowed`,
  resourceUrlInvalid: "Enter a valid http(s) URL",
  resourcesTooMany: `At most ${MAX_TASK_RESOURCES} resource links are allowed`,
  resourceLabelTooLong: `Label must be at most ${MAX_TASK_RESOURCE_LABEL_LENGTH} characters`,
};

export function createTaskContentSchema(messages: TaskFormMessages) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, messages.nameRequired)
      .max(MAX_TASK_NAME_LENGTH, messages.nameTooLong),
    description: z.string().max(MAX_TASK_DESCRIPTION_LENGTH, messages.descriptionTooLong),
    dueDateKey: z.string(),
    attachmentFileIds: z.array(z.string()).max(MAX_TASK_ATTACHMENTS, messages.attachmentsTooMany),
    procedureSteps: z
      .array(
        z.object({
          key: z.string(),
          body: z.string().max(MAX_TASK_PROCEDURE_STEP_LENGTH, messages.procedureStepTooLong),
        }),
      )
      .max(MAX_TASK_PROCEDURE_STEPS, messages.procedureStepsTooMany),
    resources: z
      .array(
        z.object({
          key: z.string(),
          url: z.string(),
          label: z.string(),
        }),
      )
      .max(MAX_TASK_RESOURCES, messages.resourcesTooMany),
    acceptLinkSubmissions: z.boolean(),
  });
}

/** Client form shape: release UI uses `releaseMode`, mapped after parse. */
export function createTaskClientFormSchema(messages: TaskFormMessages) {
  return createTaskContentSchema(messages).extend({
    releaseMode: z.enum(["released", "hidden", "scheduled"]),
    scheduledReleaseAt: z.string(),
  });
}

/** Server / `parseTaskInput` shape: persisted release fields. */
export function createTaskFormSchema(messages: TaskFormMessages) {
  return createTaskContentSchema(messages).extend({
    hiddenFromStudents: z.boolean(),
    scheduledReleaseAt: z.string(),
  });
}

export const taskFormSchemaEn = createTaskFormSchema(TASK_FORM_MESSAGES_EN);

export function normalizeTaskProcedureSteps(
  steps: Array<{ key?: string; body?: string }> | undefined,
  messages: TaskFormMessages = TASK_FORM_MESSAGES_EN,
): TaskProcedureStep[] {
  if (!steps || steps.length === 0) return [];
  if (steps.length > MAX_TASK_PROCEDURE_STEPS) {
    throw new Error(messages.procedureStepsTooMany);
  }
  return steps.map((step, index) => {
    const key = step.key?.trim() || `step-${index}`;
    const body = step.body?.trim() ?? "";
    if (!body) {
      throw new Error(messages.procedureStepRequired);
    }
    if (body.length > MAX_TASK_PROCEDURE_STEP_LENGTH) {
      throw new Error(messages.procedureStepTooLong);
    }
    return { key, body };
  });
}

export function normalizeTaskResources(
  resources: Array<{ key?: string; url?: string; label?: string }> | undefined,
): TaskResource[] {
  return normalizeLessonResources(
    resources?.map((resource, index) => ({
      key: resource.key?.trim() || `resource-${index}`,
      url: resource.url ?? "",
      ...(resource.label !== undefined ? { label: resource.label } : {}),
    })),
  );
}

export function parseTaskInput(
  input: {
    name: string;
    description?: string;
    dueDateKey?: string;
    attachmentFileIds?: string[];
    procedureSteps?: Array<{ key?: string; body?: string }>;
    resources?: Array<{ key?: string; url?: string; label?: string }>;
    acceptLinkSubmissions?: boolean;
    hiddenFromStudents?: boolean;
    scheduledReleaseAt?: string;
  },
  messages: TaskFormMessages = TASK_FORM_MESSAGES_EN,
): {
  name: string;
  description: string;
  dueDateKey: string;
  attachmentFileIds: string[];
  procedureSteps: TaskProcedureStep[];
  resources: TaskResource[];
  acceptLinkSubmissions: boolean;
  hiddenFromStudents: boolean;
  scheduledReleaseAt: string;
} {
  const schema = createTaskFormSchema(messages);
  const parsed = schema.safeParse({
    name: input.name,
    description: input.description ?? "",
    dueDateKey: input.dueDateKey ?? "",
    attachmentFileIds: input.attachmentFileIds ?? [],
    procedureSteps: (input.procedureSteps ?? []).map((step, index) => ({
      key: step.key ?? `step-${index}`,
      body: step.body ?? "",
    })),
    resources: (input.resources ?? []).map((resource, index) => ({
      key: resource.key ?? `resource-${index}`,
      url: resource.url ?? "",
      label: resource.label ?? "",
    })),
    acceptLinkSubmissions: input.acceptLinkSubmissions === true,
    hiddenFromStudents: input.hiddenFromStudents === true,
    scheduledReleaseAt: input.scheduledReleaseAt ?? "",
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  return {
    ...parsed.data,
    procedureSteps: normalizeTaskProcedureSteps(parsed.data.procedureSteps, messages),
    resources: normalizeTaskResources(parsed.data.resources),
  };
}

export { isValidHttpUrl };
