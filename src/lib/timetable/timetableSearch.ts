import { z } from "zod";

import {
  formatLocalDateKey,
  parseDateKeyLocal,
} from "../../../convex/lib/timetable/timetableSchema";
import { getWeekStart } from "@/lib/timetable/utils";

export const timetableSearchSchema = z.object({
  view: z.enum(["week", "day"]).optional().catch("week"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type TimetableViewMode = "week" | "day";
export type TimetableSearch = z.infer<typeof timetableSearchSchema>;

export function parseTimetableSearch(search: TimetableSearch): {
  view: TimetableViewMode;
  currentDate: Date;
  weekStart: Date;
} {
  const view = search.view ?? "week";
  const currentDate = search.date ? parseDateKeyLocal(search.date) : new Date();
  const weekStart = getWeekStart(currentDate);
  return { view, currentDate, weekStart };
}

export function toDateSearchParam(date: Date): string {
  return formatLocalDateKey(date);
}

export function clampDateToTerm(date: Date, startDateKey: string, endDateKey: string): Date {
  const start = parseDateKeyLocal(startDateKey);
  const end = parseDateKeyLocal(endDateKey);
  if (date < start) return start;
  if (date > end) return end;
  return date;
}
