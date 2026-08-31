import type { TFunction } from "i18next";

import {
  createAgendaPrefaceSchema,
  createTimetableDisableScopeFormSchema,
  createTimetableLessonFormSchema,
  createTimetableLinkSlotsFormSchema,
  createTimetableSlotFormSchema,
  createTimetableSubjectFormSchema,
  createTimetableTermFormSchema,
  type TimetableDisableScopeFormMessages,
  type TimetableFormMessages,
  type TimetableLessonFormMessages,
  type TimetableSubjectFormMessages,
} from "../../../convex/lib/timetable/timetableFormSchema";

export type {
  TimetableDisableScopeFormValues,
  TimetableLessonFormValues,
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
    itemTextTooLong: t("validationItemTextTooLong"),
    tooManyItems: t("validationTooManyItems"),
    audienceRolesRequired: t("validationAudienceRolesRequired"),
    audienceRoleInvalid: t("validationAudienceRoleInvalid"),
  };
  return createTimetableSubjectFormSchema(messages);
}

export function createClientAgendaPrefaceSchema(t: TFunction<"timetable">) {
  return createAgendaPrefaceSchema({
    itemTextTooLong: t("validationItemTextTooLong"),
  });
}

export function createClientTimetableLessonFormSchema(t: TFunction<"timetable">) {
  const messages: TimetableLessonFormMessages = {
    itemTextTooLong: t("validationItemTextTooLong"),
    tooManyItems: t("validationTooManyItems"),
    lessonUrlInvalid: t("validationLessonUrlInvalid"),
    lessonUrlTooLong: t("validationLessonUrlTooLong"),
  };
  return createTimetableLessonFormSchema(messages);
}

export function createClientTimetableDisableScopeFormSchema(t: TFunction<"timetable">) {
  const messages: TimetableDisableScopeFormMessages = {
    scopeRequired: t("validationDisableScopeRequired"),
  };
  return createTimetableDisableScopeFormSchema(messages);
}
