import type { TFunction } from "i18next";

import {
  createTimetableLinkSlotsFormSchema,
  createTimetableSlotFormSchema,
  createTimetableSubjectFormSchema,
  createTimetableTermFormSchema,
  type TimetableFormMessages,
  type TimetableSubjectFormMessages,
} from "../../../convex/lib/timetable/timetableFormSchema";

export type {
  TimetableSlotFormValues,
  TimetableSubjectFormValues,
  TimetableTermFormValues,
  TimetableLinkSlotsFormValues,
} from "../../../convex/lib/timetable/timetableFormSchema";

export function createClientTimetableLinkSlotsFormSchema() {
  return createTimetableLinkSlotsFormSchema();
}

export function createClientTimetableFormMessages(
  t: TFunction<"timetable">,
): TimetableFormMessages {
  return {
    nameRequired: t("validationNameRequired"),
    nameTooLong: t("validationNameTooLong"),
    dateRequired: t("validationDateRequired"),
    timeRequired: t("validationTimeRequired"),
    endAfterStart: t("validationEndAfterStart"),
    daysRequired: t("validationDaysRequired"),
    invalidDay: t("validationInvalidDay"),
  };
}

export function createClientTimetableTermFormSchema(t: TFunction<"timetable">) {
  return createTimetableTermFormSchema(createClientTimetableFormMessages(t));
}

export function createClientTimetableSlotFormSchema(t: TFunction<"timetable">) {
  return createTimetableSlotFormSchema(createClientTimetableFormMessages(t));
}

export function createClientTimetableSubjectFormSchema(t: TFunction<"timetable">) {
  const messages: TimetableSubjectFormMessages = {
    nameRequired: t("validationNameRequired"),
    nameTooLong: t("validationNameTooLong"),
    colorRequired: t("validationColorRequired"),
  };
  return createTimetableSubjectFormSchema(messages);
}
