import { z } from "zod";

import {
  CALENDAR_AUDIENCE_ROLES,
  assertReminderRolesSubset,
  uniqueAudienceRoles,
  type CalendarAudienceRole,
} from "./audience.js";
import {
  compareDateKeys,
  inclusiveEndToExclusive,
  isValidDateKey,
  isValidTimeHm,
} from "./dateKey.js";
import {
  MAX_REMINDER_AMOUNT,
  MAX_REMINDERS_PER_EVENT,
  REMINDER_UNITS,
  type ReminderUnit,
} from "./reminders.js";
import { isValidTimeZone, zonedLocalToUtcMs } from "./timeZone.js";

export const MAX_EVENT_TITLE_LENGTH = 120;
export const MAX_EVENT_DESCRIPTION_LENGTH = 50_000;
export const MAX_CALENDAR_EVENT_ATTACHMENTS = 5;

export const EMPTY_EVENT_DESCRIPTION = {
  type: "doc",
  content: [{ type: "paragraph" }],
} as const;

export const EMPTY_EVENT_DESCRIPTION_JSON = JSON.stringify(EMPTY_EVENT_DESCRIPTION);

export type CalendarEventMessages = {
  titleRequired: string;
  titleTooLong: string;
  descriptionTooLong: string;
  timezoneRequired: string;
  timezoneInvalid: string;
  timezoneMissingForTimed: string;
  dateInvalid: string;
  timeInvalid: string;
  endAfterStart: string;
  endDateAfterStart: string;
  audienceRolesRequired: string;
  audienceRoleInvalid: string;
  reminderAmountInvalid: string;
  remindersTooMany: string;
  reminderRoleSubset: string;
};

export const CALENDAR_EVENT_MESSAGES_EN: CalendarEventMessages = {
  titleRequired: "Title is required",
  titleTooLong: `Title must be at most ${MAX_EVENT_TITLE_LENGTH} characters`,
  descriptionTooLong: `Description must be at most ${MAX_EVENT_DESCRIPTION_LENGTH} characters`,
  timezoneRequired: "Set the class time zone before creating timed events",
  timezoneInvalid: "Invalid time zone",
  timezoneMissingForTimed: "Set the class time zone before creating timed events",
  dateInvalid: "Enter a valid date",
  timeInvalid: "Enter a valid time",
  endAfterStart: "End must be after start",
  endDateAfterStart: "End date must be on or after the start date",
  audienceRolesRequired: "Select at least one role",
  audienceRoleInvalid: "Invalid audience role",
  reminderAmountInvalid: `Reminder amount must be between 1 and ${MAX_REMINDER_AMOUNT}`,
  remindersTooMany: `At most ${MAX_REMINDERS_PER_EVENT} reminders are allowed`,
  reminderRoleSubset: "Reminder roles must be a subset of the event audience",
};

const reminderUnitSchema = z.enum(REMINDER_UNITS);

export type CalendarEventFormValues = {
  title: string;
  description: string;
  allDay: boolean;
  startDateKey: string;
  startTime: string;
  endDateKey: string;
  endTime: string;
  audienceKind: "all" | "roles";
  audienceRoles: Array<CalendarAudienceRole>;
  reminders: Array<{
    amount: number;
    unit: ReminderUnit;
    notifyRoles: Array<CalendarAudienceRole>;
  }>;
};

export type NormalizedCalendarEvent = {
  title: string;
  description?: string;
  allDay: boolean;
  timezone?: string;
  startAt?: number;
  endAt?: number;
  startDateKey?: string;
  endDateKey?: string;
  audienceKind: "all" | "roles";
  audienceRoles: Array<CalendarAudienceRole>;
  reminders: Array<{
    amount: number;
    unit: ReminderUnit;
    notifyRoles: Array<CalendarAudienceRole>;
  }>;
};

export function createCalendarEventFormSchema(messages: CalendarEventMessages) {
  const reminderSchema = z.object({
    amount: z
      .number()
      .int()
      .min(1, messages.reminderAmountInvalid)
      .max(MAX_REMINDER_AMOUNT, messages.reminderAmountInvalid),
    unit: reminderUnitSchema,
    notifyRoles: z.array(z.enum(CALENDAR_AUDIENCE_ROLES)),
  });

  return z
    .object({
      title: z
        .string()
        .trim()
        .min(1, messages.titleRequired)
        .max(MAX_EVENT_TITLE_LENGTH, messages.titleTooLong),
      description: z.string().max(MAX_EVENT_DESCRIPTION_LENGTH, messages.descriptionTooLong),
      allDay: z.boolean(),
      startDateKey: z.string().refine(isValidDateKey, messages.dateInvalid),
      startTime: z.string(),
      endDateKey: z.string().refine(isValidDateKey, messages.dateInvalid),
      endTime: z.string(),
      audienceKind: z.enum(["all", "roles"]),
      audienceRoles: z.array(z.enum(CALENDAR_AUDIENCE_ROLES)),
      reminders: z.array(reminderSchema).max(MAX_REMINDERS_PER_EVENT, messages.remindersTooMany),
    })
    .superRefine((value, ctx) => {
      if (!value.allDay) {
        if (!isValidTimeHm(value.startTime)) {
          ctx.addIssue({ code: "custom", message: messages.timeInvalid, path: ["startTime"] });
        }
        if (!isValidTimeHm(value.endTime)) {
          ctx.addIssue({ code: "custom", message: messages.timeInvalid, path: ["endTime"] });
        }
      }
      if (value.audienceKind === "roles" && value.audienceRoles.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: messages.audienceRolesRequired,
          path: ["audienceRoles"],
        });
      }
      const datesValid = isValidDateKey(value.startDateKey) && isValidDateKey(value.endDateKey);
      if (datesValid && compareDateKeys(value.endDateKey, value.startDateKey) < 0) {
        ctx.addIssue({
          code: "custom",
          message: messages.endDateAfterStart,
          path: ["endDateKey"],
        });
      } else if (
        !value.allDay &&
        datesValid &&
        isValidTimeHm(value.startTime) &&
        isValidTimeHm(value.endTime)
      ) {
        const startStamp = `${value.startDateKey}T${value.startTime}`;
        const endStamp = `${value.endDateKey}T${value.endTime}`;
        if (endStamp <= startStamp) {
          ctx.addIssue({ code: "custom", message: messages.endAfterStart, path: ["endTime"] });
        }
      }
    });
}

export const calendarEventFormSchemaEn = createCalendarEventFormSchema(CALENDAR_EVENT_MESSAGES_EN);

function isTiptapDoc(value: unknown): boolean {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as { type?: unknown }).type === "doc",
  );
}

function tiptapTextContent(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const record = node as { type?: unknown; text?: unknown; content?: unknown };
  const own = typeof record.text === "string" ? record.text : "";
  if (!Array.isArray(record.content)) return own;
  const joined = record.content.map((child) => tiptapTextContent(child)).join("");
  const text = own + joined;
  if (record.type === "paragraph" || record.type === "heading") {
    return `${text}\n`;
  }
  return text;
}

/** Wrap legacy plain-text descriptions as a TipTap doc so old events still render. */
export function coerceEventDescriptionJson(value: string | undefined): string {
  if (!value || !value.trim()) return EMPTY_EVENT_DESCRIPTION_JSON;
  const trimmed = value.trim();
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (isTiptapDoc(parsed)) return trimmed;
  } catch {
    // Legacy plain text.
  }
  const content = trimmed
    .split("\n")
    .map((line) =>
      line.length > 0
        ? { type: "paragraph", content: [{ type: "text", text: line }] }
        : { type: "paragraph" },
    );
  return JSON.stringify({ type: "doc", content });
}

export function eventDescriptionPlainText(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    if (isTiptapDoc(parsed)) {
      const text = tiptapTextContent(parsed).replace(/\n+$/u, "").trim();
      return text || undefined;
    }
  } catch {
    // Legacy plain text.
  }
  return value.trim() || undefined;
}

export function eventDescriptionHasContent(value: string | undefined): boolean {
  return Boolean(eventDescriptionPlainText(value));
}

function normalizeEventDescription(
  description: string,
  messages: CalendarEventMessages,
): string | undefined {
  const coerced = coerceEventDescriptionJson(description);
  if (coerced.length > MAX_EVENT_DESCRIPTION_LENGTH) {
    throw new Error(messages.descriptionTooLong);
  }
  const parsed: unknown = JSON.parse(coerced);
  if (tiptapTextContent(parsed).replace(/\n+$/u, "").trim().length === 0) {
    return undefined;
  }
  return coerced;
}

export function normalizeCalendarEventInput(
  values: CalendarEventFormValues,
  classTimeZone: string | undefined,
  messages: CalendarEventMessages = CALENDAR_EVENT_MESSAGES_EN,
): NormalizedCalendarEvent {
  const parsed = createCalendarEventFormSchema(messages).parse(values);
  const title = parsed.title.trim();
  const description = normalizeEventDescription(parsed.description, messages);
  const audienceKind = parsed.audienceKind;
  const audienceRoles = audienceKind === "all" ? [] : uniqueAudienceRoles(parsed.audienceRoles);

  const reminders = parsed.reminders.map((reminder) => {
    try {
      return {
        amount: reminder.amount,
        unit: reminder.unit,
        notifyRoles: assertReminderRolesSubset(audienceKind, audienceRoles, reminder.notifyRoles),
      };
    } catch {
      throw new Error(messages.reminderRoleSubset);
    }
  });

  if (parsed.allDay) {
    return {
      title,
      description,
      allDay: true,
      timezone: classTimeZone && isValidTimeZone(classTimeZone) ? classTimeZone : undefined,
      startDateKey: parsed.startDateKey,
      endDateKey: inclusiveEndToExclusive(parsed.endDateKey),
      audienceKind,
      audienceRoles,
      reminders,
    };
  }

  if (!classTimeZone || !isValidTimeZone(classTimeZone)) {
    throw new Error(messages.timezoneMissingForTimed);
  }

  const startAt = zonedLocalToUtcMs(parsed.startDateKey, parsed.startTime, classTimeZone);
  const endAt = zonedLocalToUtcMs(parsed.endDateKey, parsed.endTime, classTimeZone);
  if (endAt <= startAt) {
    throw new Error(messages.endAfterStart);
  }

  return {
    title,
    description,
    allDay: false,
    timezone: classTimeZone,
    startAt,
    endAt,
    audienceKind,
    audienceRoles,
    reminders,
  };
}

export const calendarEventFormSchemaEnParse = calendarEventFormSchemaEn;
