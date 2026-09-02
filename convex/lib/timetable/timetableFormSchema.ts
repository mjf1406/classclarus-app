import { z } from "zod";

import { CALENDAR_AUDIENCE_ROLES } from "../calendar/audience.js";
import { MAX_ITEM_TEXT_LENGTH, MAX_SECTION_ITEMS } from "./sectionItems.js";
import {
  isValidHttpUrl,
  MAX_LESSON_RESOURCES,
  MAX_LESSON_URL_LENGTH,
  MAX_RESOURCE_LABEL_LENGTH,
  MAX_SUBJECT_NAME_LENGTH,
  MAX_TERM_NAME_LENGTH,
  WEEKDAY_NAMES,
} from "./timetableSchema.js";
import { SLOT_DISABLE_SCOPES } from "./slotDisableScope.js";

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
  itemTextTooLong: string;
  tooManyItems: string;
  audienceRolesRequired: string;
  audienceRoleInvalid: string;
};

export const TIMETABLE_SUBJECT_FORM_MESSAGES_EN: TimetableSubjectFormMessages = {
  nameRequired: TIMETABLE_FORM_MESSAGES_EN.nameRequired,
  nameTooLong: `Name must be at most ${MAX_SUBJECT_NAME_LENGTH} characters`,
  colorRequired: "Enter a valid color",
  itemTextTooLong: `Item text must be at most ${MAX_ITEM_TEXT_LENGTH} characters`,
  tooManyItems: `At most ${MAX_SECTION_ITEMS} items are allowed`,
  audienceRolesRequired: "Select at least one audience",
  audienceRoleInvalid: "Invalid audience role",
};

const hexColorSchema = (message: string) =>
  z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, message);

const sectionItemFormSchema = (messages: TimetableSubjectFormMessages) =>
  z.object({
    key: z.string().min(1),
    text: z.string().max(MAX_ITEM_TEXT_LENGTH, messages.itemTextTooLong),
    tags: z.array(z.string()),
  });

const agendaItemFormSchema = (messages: TimetableSubjectFormMessages) =>
  sectionItemFormSchema(messages).extend({
    assignmentId: z.string().optional(),
    taskId: z.string().optional(),
    preface: z.string().trim().max(MAX_ITEM_TEXT_LENGTH, messages.itemTextTooLong).optional(),
  });

export function createAgendaPrefaceSchema(
  messages: Pick<TimetableSubjectFormMessages, "itemTextTooLong">,
) {
  return z.object({
    preface: z.string().trim().max(MAX_ITEM_TEXT_LENGTH, messages.itemTextTooLong),
  });
}

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
    defaultMaterials: z
      .array(sectionItemFormSchema(messages))
      .max(MAX_SECTION_ITEMS, messages.tooManyItems),
    defaultAnnouncements: z
      .array(sectionItemFormSchema(messages))
      .max(MAX_SECTION_ITEMS, messages.tooManyItems),
    defaultAgenda: z
      .array(agendaItemFormSchema(messages))
      .max(MAX_SECTION_ITEMS, messages.tooManyItems),
    calendarAudienceRoles: z
      .array(z.string())
      .min(1, messages.audienceRolesRequired)
      .superRefine((roles, ctx) => {
        for (const role of roles) {
          if (!(CALENDAR_AUDIENCE_ROLES as ReadonlyArray<string>).includes(role)) {
            ctx.addIssue({ code: "custom", message: messages.audienceRoleInvalid });
            return;
          }
        }
      }),
  });
}

export type TimetableLessonFormMessages = {
  itemTextTooLong: string;
  tooManyItems: string;
  lessonUrlInvalid: string;
  lessonUrlTooLong: string;
  tooManyResources: string;
  resourceLabelTooLong: string;
};

export const TIMETABLE_LESSON_FORM_MESSAGES_EN: TimetableLessonFormMessages = {
  itemTextTooLong: TIMETABLE_SUBJECT_FORM_MESSAGES_EN.itemTextTooLong,
  tooManyItems: TIMETABLE_SUBJECT_FORM_MESSAGES_EN.tooManyItems,
  lessonUrlInvalid: "Enter a valid http(s) URL",
  lessonUrlTooLong: `URL must be at most ${MAX_LESSON_URL_LENGTH} characters`,
  tooManyResources: `At most ${MAX_LESSON_RESOURCES} resource links are allowed`,
  resourceLabelTooLong: `Label must be at most ${MAX_RESOURCE_LABEL_LENGTH} characters`,
};

const lessonResourceFormSchema = (messages: TimetableLessonFormMessages) =>
  z.object({
    key: z.string().min(1),
    url: z
      .string()
      .trim()
      .max(MAX_LESSON_URL_LENGTH, messages.lessonUrlTooLong)
      .refine((value) => value.length === 0 || isValidHttpUrl(value), messages.lessonUrlInvalid),
    label: z
      .string()
      .trim()
      .max(MAX_RESOURCE_LABEL_LENGTH, messages.resourceLabelTooLong)
      .optional()
      .default(""),
  });

export function createTimetableLessonFormSchema(messages: TimetableLessonFormMessages) {
  const subjectMessages: TimetableSubjectFormMessages = {
    ...TIMETABLE_SUBJECT_FORM_MESSAGES_EN,
    itemTextTooLong: messages.itemTextTooLong,
    tooManyItems: messages.tooManyItems,
  };
  return z.object({
    complete: z.boolean(),
    lessonUrlShared: z.boolean(),
    lessonUrl: z
      .string()
      .trim()
      .max(MAX_LESSON_URL_LENGTH, messages.lessonUrlTooLong)
      .refine((value) => value.length === 0 || isValidHttpUrl(value), messages.lessonUrlInvalid),
    resourcesShared: z.boolean(),
    resources: z
      .array(lessonResourceFormSchema(messages))
      .max(MAX_LESSON_RESOURCES, messages.tooManyResources),
    materials: z
      .array(sectionItemFormSchema(subjectMessages))
      .max(MAX_SECTION_ITEMS, messages.tooManyItems),
    announcements: z
      .array(sectionItemFormSchema(subjectMessages))
      .max(MAX_SECTION_ITEMS, messages.tooManyItems),
    agenda: z
      .array(agendaItemFormSchema(subjectMessages))
      .max(MAX_SECTION_ITEMS, messages.tooManyItems),
  });
}

export type TimetableDisableScopeFormMessages = {
  scopeRequired: string;
};

export const TIMETABLE_DISABLE_SCOPE_FORM_MESSAGES_EN: TimetableDisableScopeFormMessages = {
  scopeRequired: "Choose a range",
};

export function createTimetableDisableScopeFormSchema(messages: TimetableDisableScopeFormMessages) {
  return z.object({
    scope: z.enum(SLOT_DISABLE_SCOPES, { error: messages.scopeRequired }),
  });
}

export const timetableTermFormSchemaEn = createTimetableTermFormSchema(TIMETABLE_FORM_MESSAGES_EN);
export const timetableSlotFormSchemaEn = createTimetableSlotFormSchema(TIMETABLE_FORM_MESSAGES_EN);
export const timetableSubjectFormSchemaEn = createTimetableSubjectFormSchema(
  TIMETABLE_SUBJECT_FORM_MESSAGES_EN,
);
export const timetableLessonFormSchemaEn = createTimetableLessonFormSchema(
  TIMETABLE_LESSON_FORM_MESSAGES_EN,
);
export const timetableDisableScopeFormSchemaEn = createTimetableDisableScopeFormSchema(
  TIMETABLE_DISABLE_SCOPE_FORM_MESSAGES_EN,
);

export type TimetableTermFormValues = z.infer<ReturnType<typeof createTimetableTermFormSchema>>;
export type TimetableSlotFormValues = z.infer<ReturnType<typeof createTimetableSlotFormSchema>>;
export type TimetableSubjectFormValues = z.infer<
  ReturnType<typeof createTimetableSubjectFormSchema>
>;
export type TimetableLessonFormValues = z.infer<ReturnType<typeof createTimetableLessonFormSchema>>;
export type TimetableDisableScopeFormValues = z.infer<
  ReturnType<typeof createTimetableDisableScopeFormSchema>
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
