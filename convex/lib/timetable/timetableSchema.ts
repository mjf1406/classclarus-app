import { v } from "convex/values";

import type { Id } from "../../_generated/dataModel.js";
import type { MutationCtx } from "../../_generated/server.js";
import { compareDateKeys, isValidDateKey, isValidTimeHm } from "../calendar/dateKey.js";

export const MAX_TERM_NAME_LENGTH = 80;
export const MAX_SUBJECT_NAME_LENGTH = 80;
export const MAX_LESSON_LINKS = 10;
export const MAX_NOTES_JSON_LENGTH = 50_000;

export const termKindValidator = v.union(
  v.literal("quarter"),
  v.literal("semester"),
  v.literal("trimester"),
  v.literal("year"),
  v.literal("custom"),
);

export const lessonLinkValidator = v.object({
  key: v.string(),
  kind: v.union(v.literal("url"), v.literal("assignment"), v.literal("task")),
  label: v.optional(v.string()),
  url: v.optional(v.string()),
  assignmentId: v.optional(v.id("assignments")),
  taskId: v.optional(v.id("tasks")),
});

export type LessonLinkInput = {
  key: string;
  kind: "url" | "assignment" | "task";
  label?: string;
  url?: string;
  assignmentId?: Id<"assignments">;
  taskId?: Id<"tasks">;
};

export const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type WeekdayName = (typeof WEEKDAY_NAMES)[number];

export function normalizeTermName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");
  if (trimmed.length > MAX_TERM_NAME_LENGTH) {
    throw new Error(`Name must be at most ${MAX_TERM_NAME_LENGTH} characters`);
  }
  return trimmed;
}

export function normalizeSubjectName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");
  if (trimmed.length > MAX_SUBJECT_NAME_LENGTH) {
    throw new Error(`Name must be at most ${MAX_SUBJECT_NAME_LENGTH} characters`);
  }
  return trimmed;
}

export function isEmptyNotesJson(value: string | undefined): boolean {
  if (!value || !value.trim()) return true;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return false;
    const doc = parsed as { type?: unknown; content?: unknown };
    if (doc.type !== "doc" || !Array.isArray(doc.content)) return false;
    if (doc.content.length === 0) return true;
    if (doc.content.length > 1) return false;
    const first = doc.content[0];
    if (!first || typeof first !== "object") return false;
    const node = first as { type?: unknown; content?: unknown };
    if (node.type !== "paragraph") return false;
    if (node.content === undefined) return true;
    return Array.isArray(node.content) && node.content.length === 0;
  } catch {
    return false;
  }
}

export function normalizeOptionalNotesJson(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || isEmptyNotesJson(trimmed)) return undefined;
  if (trimmed.length > MAX_NOTES_JSON_LENGTH) {
    throw new Error(`Notes must be at most ${MAX_NOTES_JSON_LENGTH} characters`);
  }
  return trimmed;
}

export function normalizeHexColor(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
    const r = trimmed[1]!;
    const g = trimmed[2]!;
    const b = trimmed[3]!;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
}

export function normalizeDays(days: Array<string>): Array<WeekdayName> {
  if (days.length === 0) throw new Error("Select at least one day");
  const unique = [...new Set(days)];
  for (const day of unique) {
    if (!(WEEKDAY_NAMES as ReadonlyArray<string>).includes(day)) {
      throw new Error("Invalid day");
    }
  }
  return unique as Array<WeekdayName>;
}

export function normalizeTimeRange(
  startTime: string,
  endTime: string,
): { startTime: string; endTime: string } {
  if (!isValidTimeHm(startTime) || !isValidTimeHm(endTime)) {
    throw new Error("Enter a valid time");
  }
  if (startTime >= endTime) {
    throw new Error("End time must be after start time");
  }
  return { startTime, endTime };
}

export function normalizeDateRange(
  startDateKey: string,
  endDateKey: string,
): {
  startDateKey: string;
  endDateKey: string;
} {
  if (!isValidDateKey(startDateKey) || !isValidDateKey(endDateKey)) {
    throw new Error("Enter a valid date");
  }
  if (compareDateKeys(endDateKey, startDateKey) < 0) {
    throw new Error("End date must be on or after start date");
  }
  return { startDateKey, endDateKey };
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function normalizeSlotTimes(
  startTime: string,
  endTime: string,
): { startTime: string; endTime: string } {
  return normalizeTimeRange(startTime, endTime);
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function normalizeLessonLinks(
  ctx: MutationCtx,
  classId: Id<"classes">,
  links: Array<LessonLinkInput>,
): Promise<Array<LessonLinkInput>> {
  if (links.length > MAX_LESSON_LINKS) {
    throw new Error(`At most ${MAX_LESSON_LINKS} links are allowed`);
  }
  const keys = new Set<string>();
  const normalized: Array<LessonLinkInput> = [];
  for (const link of links) {
    const key = link.key.trim();
    if (!key) throw new Error("Link key is required");
    if (keys.has(key)) throw new Error("Duplicate link key");
    keys.add(key);

    if (link.kind === "url") {
      const url = link.url?.trim() ?? "";
      if (!url || !isValidHttpUrl(url)) {
        throw new Error("Enter a valid http(s) URL");
      }
      const label = link.label?.trim();
      normalized.push({
        key,
        kind: "url",
        url,
        label: label || undefined,
      });
      continue;
    }

    if (link.kind === "assignment") {
      if (!link.assignmentId) throw new Error("Assignment is required");
      const assignment = await ctx.db.get("assignments", link.assignmentId);
      if (!assignment || assignment.classId !== classId) {
        throw new Error("Assignment not found");
      }
      const label = link.label?.trim() || assignment.name;
      normalized.push({
        key,
        kind: "assignment",
        assignmentId: link.assignmentId,
        label,
      });
      continue;
    }

    if (!link.taskId) throw new Error("Task is required");
    const task = await ctx.db.get("tasks", link.taskId);
    if (!task || task.classId !== classId) {
      throw new Error("Task not found");
    }
    const label = link.label?.trim() || task.name;
    normalized.push({
      key,
      kind: "task",
      taskId: link.taskId,
      label,
    });
  }
  return normalized;
}

export function getIsoWeekYearAndNumber(date: Date): { year: number; weekNumber: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), weekNumber };
}

export function parseDateKeyLocal(dateKey: string): Date {
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(5, 7)) - 1;
  const day = Number(dateKey.slice(8, 10));
  return new Date(year, month, day);
}

export function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
