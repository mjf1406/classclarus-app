import type { FunctionReturnType } from "convex/server";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export type TimetableTerm = FunctionReturnType<typeof api.timetable.listTerms>[number];
export type TimetableWeekBundle = FunctionReturnType<typeof api.timetable.getWeekBundle>;
export type TimetableSlot = TimetableWeekBundle["slots"][number];
export type TimetableSubject = TimetableWeekBundle["subjects"][number];
export type TimetableLesson = TimetableWeekBundle["lessons"][number];
export type TimetableLessonLink = TimetableLesson["links"][number];

export type TimetableTermKind = TimetableTerm["kind"];

export type LessonLinkFormValues = {
  key: string;
  kind: "url" | "assignment" | "task";
  label?: string;
  url?: string;
  assignmentId?: Id<"assignments">;
  taskId?: Id<"tasks">;
};

export const COMPACT_SLOT_MAX_MINUTES = 20;
export const SLOT_MIN_HEIGHT_REM = 2.75;
export const PIXELS_PER_MINUTE = 2;
export const MIN_PIXELS_PER_MINUTE = 1;

export const EMPTY_NOTES_JSON = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph" }],
});
