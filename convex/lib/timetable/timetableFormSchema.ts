import { z } from "zod";

import { MAX_SUBJECT_NAME_LENGTH, MAX_TERM_NAME_LENGTH, WEEKDAY_NAMES } from "./timetableSchema.js";

export type TimetableFormMessages = {
  nameRequired: string;
  nameTooLong: string;
  dateRequired: string;
  timeRequired: string;
  endAfterStart: string;
  daysRequired: string;
  invalidDay: string;
};

export const TIMETABLE_FORM_MESSAGES_EN: TimetableFormMessages = {
  nameRequired: "Name is required",
  nameTooLong: `Name must be at most ${MAX_TERM_NAME_LENGTH} characters`,
  dateRequired: "Enter a valid date",
  timeRequired: "Enter a valid time",
  endAfterStart: "End time must be after start time",
  daysRequired: "Select at least one day",
  invalidDay: "Invalid day",
};

const timeHmSchema = (messages: TimetableFormMessages) =>
  z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, messages.timeRequired);

export function createTimetableTermFormSchema(messages: TimetableFormMessages) {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(1, messages.nameRequired)
        .max(MAX_TERM_NAME_LENGTH, messages.nameTooLong),
      kind: z.enum(["quarter", "semester", "trimester", "year", "custom"]),
      startDateKey: z.string().trim().min(1, messages.dateRequired),
      endDateKey: z.string().trim().min(1, messages.dateRequired),
      days: z.array(z.string()).min(1, messages.daysRequired),
      startTime: timeHmSchema(messages),
      endTime: timeHmSchema(messages),
      copyFromTermId: z.string().optional(),
    })
    .superRefine((value, ctx) => {
      for (const day of value.days) {
        if (!(WEEKDAY_NAMES as ReadonlyArray<string>).includes(day)) {
          ctx.addIssue({ code: "custom", message: messages.invalidDay, path: ["days"] });
        }
      }
      if (value.startTime >= value.endTime) {
        ctx.addIssue({ code: "custom", message: messages.endAfterStart, path: ["endTime"] });
      }
    });
}

export function createTimetableSlotFormSchema(messages: TimetableFormMessages) {
  return z
    .object({
      day: z.string().trim().min(1, messages.invalidDay),
      startTime: timeHmSchema(messages),
      endTime: timeHmSchema(messages),
      disabled: z.boolean().optional(),
    })
    .superRefine((value, ctx) => {
      if (value.startTime >= value.endTime) {
        ctx.addIssue({ code: "custom", message: messages.endAfterStart, path: ["endTime"] });
      }
    });
}

export type TimetableSubjectFormMessages = {
  nameRequired: string;
  nameTooLong: string;
  colorRequired: string;
};

export const TIMETABLE_SUBJECT_FORM_MESSAGES_EN: TimetableSubjectFormMessages = {
  nameRequired: TIMETABLE_FORM_MESSAGES_EN.nameRequired,
  nameTooLong: `Name must be at most ${MAX_SUBJECT_NAME_LENGTH} characters`,
  colorRequired: "Enter a valid color",
};

const hexColorSchema = (message: string) =>
  z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, message);

export function createTimetableSubjectFormSchema(messages: TimetableSubjectFormMessages) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, messages.nameRequired)
      .max(MAX_SUBJECT_NAME_LENGTH, messages.nameTooLong),
    bgColor: hexColorSchema(messages.colorRequired),
    textColor: hexColorSchema(messages.colorRequired),
    iconName: z.string().optional(),
  });
}

export const timetableTermFormSchemaEn = createTimetableTermFormSchema(TIMETABLE_FORM_MESSAGES_EN);
export const timetableSlotFormSchemaEn = createTimetableSlotFormSchema(TIMETABLE_FORM_MESSAGES_EN);
export const timetableSubjectFormSchemaEn = createTimetableSubjectFormSchema(
  TIMETABLE_SUBJECT_FORM_MESSAGES_EN,
);

export type TimetableTermFormValues = z.infer<ReturnType<typeof createTimetableTermFormSchema>>;
export type TimetableSlotFormValues = z.infer<ReturnType<typeof createTimetableSlotFormSchema>>;
export type TimetableSubjectFormValues = z.infer<
  ReturnType<typeof createTimetableSubjectFormSchema>
>;

export type TimetableTermKindForm = "quarter" | "semester" | "trimester" | "year" | "custom";

export function createTimetableLinkSlotsFormSchema() {
  return z.object({
    selectedSlotIds: z.array(z.string()),
  });
}

export type TimetableLinkSlotsFormValues = z.infer<
  ReturnType<typeof createTimetableLinkSlotsFormSchema>
>;
