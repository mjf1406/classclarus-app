import type { FunctionReturnType } from "convex/server";

import { api } from "../../../convex/_generated/api";

export type TimetableTerm = FunctionReturnType<typeof api.timetable.listTerms>[number];
export type TimetableWeekBundle = FunctionReturnType<typeof api.timetable.getWeekBundle>;
export type TimetableSlot = TimetableWeekBundle["slots"][number];
export type TimetableSubject = TimetableWeekBundle["subjects"][number];
export type TimetableLesson = TimetableWeekBundle["lessons"][number];
export type TimetableSectionItem = TimetableLesson["materials"][number];
export type TimetableAgendaItem = TimetableLesson["agenda"][number];
export type TimetableUpcomingEvent = TimetableLesson["upcomingEvents"][number];
export type TimetableTag = { tag: string; display: string };

export type TimetableTermKind = TimetableTerm["kind"];

export type SectionItemFormValues = {
  key: string;
  text: string;
  tags: Array<string>;
};

export type AgendaItemFormValues = SectionItemFormValues & {
  assignmentId?: string;
  taskId?: string;
  preface?: string;
};

export type LessonResourceFormValues = {
  key: string;
  url: string;
  label: string;
};

export const COMPACT_SLOT_MAX_MINUTES = 20;
export const SLOT_MIN_HEIGHT_REM = 2.75;
export const PIXELS_PER_MINUTE = 2;
export const MIN_PIXELS_PER_MINUTE = 1;

export function emptySectionItem(key: string): SectionItemFormValues {
  return { key, text: "", tags: [] };
}

export function emptyAgendaItem(key: string): AgendaItemFormValues {
  return { key, text: "", tags: [] };
}

export function emptyLessonResource(key: string): LessonResourceFormValues {
  return { key, url: "", label: "" };
}
