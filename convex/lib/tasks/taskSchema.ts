import { z } from "zod";

export const MAX_TASK_NAME_LENGTH = 100;
export const MAX_TASK_DESCRIPTION_LENGTH = 500;
export const MAX_TASK_ATTACHMENTS = 5;

export type TaskFormMessages = {
  nameRequired: string;
  nameTooLong: string;
  descriptionTooLong: string;
  attachmentsTooMany: string;
};

/** English messages used by the Convex server. */
export const TASK_FORM_MESSAGES_EN: TaskFormMessages = {
  nameRequired: "Name is required",
  nameTooLong: `Name must be at most ${MAX_TASK_NAME_LENGTH} characters`,
  descriptionTooLong: `Description must be at most ${MAX_TASK_DESCRIPTION_LENGTH} characters`,
  attachmentsTooMany: `At most ${MAX_TASK_ATTACHMENTS} attachments allowed`,
};

export function createTaskFormSchema(messages: TaskFormMessages) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, messages.nameRequired)
      .max(MAX_TASK_NAME_LENGTH, messages.nameTooLong),
    description: z.string().max(MAX_TASK_DESCRIPTION_LENGTH, messages.descriptionTooLong),
    dueDateKey: z.string(),
    attachmentFileIds: z.array(z.string()).max(MAX_TASK_ATTACHMENTS, messages.attachmentsTooMany),
  });
}

export const taskFormSchemaEn = createTaskFormSchema(TASK_FORM_MESSAGES_EN);

export function parseTaskInput(
  input: {
    name: string;
    description?: string;
    dueDateKey?: string;
    attachmentFileIds?: string[];
  },
  messages: TaskFormMessages = TASK_FORM_MESSAGES_EN,
): {
  name: string;
  description: string;
  dueDateKey: string;
  attachmentFileIds: string[];
} {
  const schema = createTaskFormSchema(messages);
  const parsed = schema.safeParse({
    name: input.name,
    description: input.description ?? "",
    dueDateKey: input.dueDateKey ?? "",
    attachmentFileIds: input.attachmentFileIds ?? [],
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  return parsed.data;
}
