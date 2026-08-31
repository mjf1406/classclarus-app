import { ConvexError, v, type Infer } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import {
  advanceSegment,
  parseSessionJson,
  resolveSegmentDuration,
  serializeSession,
  type ActiveSession,
} from "./lib/classroomScreen/activeSession.js";
import { audioCuesValidator } from "./lib/classroomScreen/audioCuesSchema.js";
import { DEFAULT_CLOCK_SETTINGS } from "./lib/classroomScreen/clockSettingsDefaults.js";
import { normalizeEndTime, secondsUntilEndTime } from "./lib/classroomScreen/timerUtils.js";
import { recordClassActivity } from "./lib/activity/classActivity.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import { parseRotationInput } from "./lib/classroomScreen/rotationSchema.js";
import { isValidTimeZone, utcMsToZonedParts } from "./lib/calendar/timeZone.js";
import {
  agendaDisplayItemValidator,
  attachAgendaResourceNames,
  stripAgendaItemReferences,
  calendarAudienceRolesOrDefault,
  sectionItemValidator,
  type AgendaItem,
} from "./lib/timetable/sectionItems.js";
import {
  lessonDateKeyFromSlot,
  selectUpcomingLessonEvents,
  upcomingLessonEventValidator,
  type LessonEventSource,
} from "./lib/timetable/lessonEvents.js";
import {
  classroomVisibleLessonUrl,
  getIsoWeekYearAndNumberFromDateKey,
} from "./lib/timetable/timetableSchema.js";
import { findCurrentSlot } from "./lib/classroomScreen/currentLesson.js";

const MAX_NAME_LENGTH = 120;
const MAX_TIMER_DURATION_SECONDS = 24 * 60 * 60;
const MAX_QUICK_TEXT_LENGTH = 20_000;

const settingsValidator = v.object({
  // Optional: unsaved defaults have no row yet. Never return "" — v.id() rejects it.
  _id: v.optional(v.id("classroomClockSettings")),
  _creationTime: v.optional(v.number()),
  classId: v.id("classes"),
  clockSize: v.number(),
  dateSize: v.number(),
  clockBgColor: v.string(),
  timerBgColor: v.string(),
  dateLocation: v.union(v.literal("above"), v.literal("below")),
  timeFormat: v.union(v.literal("12h"), v.literal("24h")),
  currentTimeSize: v.optional(v.number()),
  endTimeSize: v.optional(v.number()),
  timerTitleSize: v.optional(v.number()),
  timerEndBehavior: v.optional(
    v.union(v.literal("countUp"), v.literal("hold"), v.literal("return")),
  ),
  overtimeAutoDismissSeconds: v.optional(v.number()),
  bgTransition: v.optional(v.string()),
  audioCues: audioCuesValidator,
  displayContentFontSize: v.optional(v.number()),
  displayHeadingFontSize: v.optional(v.number()),
  quickText: v.optional(v.string()),
  quickTextTitle: v.optional(v.string()),
  updatedAt: v.number(),
});

type ClockSettingsDto = Infer<typeof settingsValidator>;

const timerValidator = v.object({
  _id: v.id("classroomTimers"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  name: v.string(),
  durationSeconds: v.number(),
  bgColor: v.string(),
  endTime: v.optional(v.string()),
  bgTransition: v.optional(v.string()),
  audioCues: audioCuesValidator,
  nextTimerId: v.optional(v.id("classroomTimers")),
  sortOrder: v.number(),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const rotationValidator = v.object({
  _id: v.id("classroomRotations"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  name: v.string(),
  rotationDurationSeconds: v.number(),
  numberOfRotations: v.number(),
  transitionDurationSeconds: v.number(),
  rotationBgColor: v.string(),
  transitionBgColor: v.string(),
  finalTransition: v.optional(v.boolean()),
  bgTransition: v.optional(v.string()),
  audioCues: audioCuesValidator,
  workCues: audioCuesValidator,
  transitionCues: audioCuesValidator,
  sortOrder: v.number(),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const audioFileValidator = v.object({
  _id: v.id("classroomAudioFiles"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  name: v.string(),
  fileId: v.id("files"),
  contentType: v.string(),
  size: v.number(),
  url: v.union(v.string(), v.null()),
  createdBy: v.id("users"),
  createdAt: v.number(),
});

const displaySessionValidator = v.object({
  // Optional: unsaved defaults have no row yet. Never return "" — v.id() rejects it.
  _id: v.optional(v.id("classroomDisplaySessions")),
  _creationTime: v.optional(v.number()),
  classId: v.id("classes"),
  sessionJson: v.optional(v.any()),
  endsAt: v.optional(v.number()),
  paused: v.boolean(),
  pausedRemainingMs: v.optional(v.number()),
  pushedLessonId: v.optional(v.id("timetableLessons")),
  pushedUntil: v.optional(v.number()),
  updatedAt: v.number(),
});

type DisplaySessionDto = Infer<typeof displaySessionValidator>;

const lessonDisplayValidator = v.object({
  _id: v.id("timetableLessons"),
  slotId: v.id("timetableSlots"),
  subjectName: v.string(),
  subjectBgColor: v.string(),
  subjectTextColor: v.string(),
  subjectIconName: v.optional(v.string()),
  startTime: v.optional(v.string()),
  endTime: v.optional(v.string()),
  materials: v.array(sectionItemValidator),
  announcements: v.array(sectionItemValidator),
  agenda: v.array(agendaDisplayItemValidator),
  upcomingEvents: v.array(upcomingLessonEventValidator),
  lessonUrl: v.optional(v.string()),
  timeZone: v.string(),
});

const slotDisplayValidator = v.object({
  _id: v.id("timetableSlots"),
  day: v.string(),
  startTime: v.string(),
  endTime: v.string(),
  disabled: v.boolean(),
});

function resolveClassTimeZone(classDoc: Doc<"classes"> | null): string {
  return classDoc?.timezone && isValidTimeZone(classDoc.timezone) ? classDoc.timezone : "UTC";
}

async function loadClassCalendarEvents(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
): Promise<{ timeZone: string; events: Array<LessonEventSource> }> {
  const classDoc = await ctx.db.get("classes", classId);
  const timeZone = resolveClassTimeZone(classDoc);
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded calendar list
  const events = (await ctx.db
    .query("calendarEvents")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect()) as Array<LessonEventSource>;
  return { timeZone, events };
}

async function loadAgendaResourceNames(
  ctx: QueryCtx | MutationCtx,
  items: ReadonlyArray<AgendaItem> | undefined,
) {
  const agenda = items ?? [];
  const assignments = new Map<string, string>();
  const tasks = new Map<string, string>();
  const assignmentIds = new Set(
    agenda
      .map((item) => item.assignmentId)
      .filter((id): id is NonNullable<typeof id> => Boolean(id)),
  );
  const taskIds = new Set(
    agenda.map((item) => item.taskId).filter((id): id is NonNullable<typeof id> => Boolean(id)),
  );
  for (const assignmentId of assignmentIds) {
    const assignment = await ctx.db.get("assignments", assignmentId);
    if (assignment) assignments.set(assignmentId, assignment.name);
  }
  for (const taskId of taskIds) {
    const task = await ctx.db.get("tasks", taskId);
    if (task) tasks.set(taskId, task.name);
  }
  const missingAssignmentIds = new Set([...assignmentIds].filter((id) => !assignments.has(id)));
  const missingTaskIds = new Set([...taskIds].filter((id) => !tasks.has(id)));
  const cleaned = stripAgendaItemReferences(agenda, {
    assignmentIds: missingAssignmentIds,
    taskIds: missingTaskIds,
  });
  return attachAgendaResourceNames(cleaned, { assignments, tasks });
}

async function mapLessonDisplay(
  ctx: QueryCtx | MutationCtx,
  lesson: Doc<"timetableLessons">,
  subject: Doc<"timetableSubjects">,
  slot: { day: string; startTime?: string; endTime?: string } | undefined,
  timeZone: string,
  events: Array<LessonEventSource>,
) {
  const dateKey = slot ? lessonDateKeyFromSlot(lesson.year, lesson.weekNumber, slot.day) : null;
  return {
    _id: lesson._id,
    slotId: lesson.slotId,
    subjectName: subject.name,
    subjectBgColor: subject.bgColor,
    subjectTextColor: subject.textColor,
    subjectIconName: subject.iconName,
    startTime: slot?.startTime,
    endTime: slot?.endTime,
    materials: lesson.materials ?? [],
    announcements: lesson.announcements ?? [],
    agenda: await loadAgendaResourceNames(ctx, lesson.agenda),
    lessonUrl: classroomVisibleLessonUrl(lesson),
    upcomingEvents: dateKey
      ? selectUpcomingLessonEvents(
          events,
          dateKey,
          timeZone,
          calendarAudienceRolesOrDefault(subject.calendarAudienceRoles),
        )
      : [],
    timeZone,
  };
}

const displayBundleValidator = v.object({
  settings: settingsValidator,
  displaySession: displaySessionValidator,
  pushedLesson: v.union(lessonDisplayValidator, v.null()),
  currentLesson: v.union(lessonDisplayValidator, v.null()),
  currentSlot: v.union(slotDisplayValidator, v.null()),
});

type DisplayBundleDto = Infer<typeof displayBundleValidator>;

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new Error(`Name must be at most ${MAX_NAME_LENGTH} characters`);
  }
  return trimmed;
}

function normalizeDurationSeconds(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || !Number.isInteger(durationSeconds)) {
    throw new Error("Duration must be a whole number of seconds");
  }
  if (durationSeconds <= 0 || durationSeconds > MAX_TIMER_DURATION_SECONDS) {
    throw new Error(`Duration must be between 1 and ${MAX_TIMER_DURATION_SECONDS} seconds`);
  }
  return durationSeconds;
}

function normalizeOptionalEndTime(endTime: string | undefined): string | undefined {
  if (endTime === undefined) return undefined;
  const trimmed = endTime.trim();
  if (!trimmed) return undefined;
  return normalizeEndTime(trimmed);
}

async function getOrCreateSettings(ctx: MutationCtx, classId: Id<"classes">) {
  const existing = await ctx.db
    .query("classroomClockSettings")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .unique();

  if (existing) return existing;

  const now = Date.now();
  const settingsId = await ctx.db.insert("classroomClockSettings", {
    classId,
    ...DEFAULT_CLOCK_SETTINGS,
    updatedAt: now,
  });
  const created = await ctx.db.get("classroomClockSettings", settingsId);
  if (!created) throw new Error("Failed to create clock settings");
  return created;
}

async function getOrCreateDisplaySession(ctx: MutationCtx, classId: Id<"classes">) {
  const existing = await ctx.db
    .query("classroomDisplaySessions")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .unique();

  if (existing) return existing;

  const now = Date.now();
  const sessionId = await ctx.db.insert("classroomDisplaySessions", {
    classId,
    paused: false,
    updatedAt: now,
  });
  const created = await ctx.db.get("classroomDisplaySessions", sessionId);
  if (!created) throw new Error("Failed to create display session");
  return created;
}

async function requireTimerInClass(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  timerId: Id<"classroomTimers">,
) {
  const timer = await ctx.db.get("classroomTimers", timerId);
  if (!timer || timer.classId !== classId) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Timer not found" });
  }
  return timer;
}

async function requireRotationInClass(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  rotationId: Id<"classroomRotations">,
) {
  const rotation = await ctx.db.get("classroomRotations", rotationId);
  if (!rotation || rotation.classId !== classId) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Rotation not found" });
  }
  return rotation;
}

async function requireAudioInClass(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  audioId: Id<"classroomAudioFiles">,
) {
  const audio = await ctx.db.get("classroomAudioFiles", audioId);
  if (!audio || audio.classId !== classId) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Audio file not found" });
  }
  return audio;
}

async function mapAudioFiles(ctx: QueryCtx | MutationCtx, classId: Id<"classes">) {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
  const rows = await ctx.db
    .query("classroomAudioFiles")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();

  const mapped = await Promise.all(
    rows.map(async (row) => {
      const file = await ctx.db.get("files", row.fileId);
      const url = file ? await ctx.storage.getUrl(file.storageId) : null;
      return {
        ...row,
        url,
      };
    }),
  );

  return mapped.sort((a, b) => a.name.localeCompare(b.name) || a._creationTime - b._creationTime);
}

async function loadCurrentLessonSnapshot(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  nowMs: number,
): Promise<{
  currentLesson: DisplayBundleDto["currentLesson"];
  currentSlot: DisplayBundleDto["currentSlot"];
}> {
  const classDoc = await ctx.db.get("classes", classId);
  const timeZone = resolveClassTimeZone(classDoc);
  const todayKey = utcMsToZonedParts(nowMs, timeZone).dateKey;
  const { year, weekNumber } = getIsoWeekYearAndNumberFromDateKey(todayKey);

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
  const terms = await ctx.db
    .query("timetableTerms")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();

  const activeTerm =
    terms.find((term) => term.startDateKey <= todayKey && term.endDateKey >= todayKey) ??
    terms[0] ??
    null;

  if (!activeTerm) {
    return { currentLesson: null, currentSlot: null };
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- term-bounded slots
  const slots = await ctx.db
    .query("timetableSlots")
    .withIndex("by_termId", (q) => q.eq("termId", activeTerm._id))
    .collect();

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- week-bounded disables
  const disables = await ctx.db
    .query("timetableSlotDisables")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();

  const disabledSlotIds = disables
    .filter((row) => row.year === year && row.weekNumber === weekNumber)
    .map((row) => row.slotId);
  const disabledSet = new Set(disabledSlotIds);
  const globalDisabled = new Set(slots.filter((slot) => slot.disabled).map((slot) => slot._id));

  const slotRows = slots.map((slot) => ({
    _id: slot._id,
    day: slot.day,
    startTime: slot.startTime,
    endTime: slot.endTime,
    disabled: slot.disabled || disabledSet.has(slot._id) || globalDisabled.has(slot._id),
  }));

  const matchedSlot = findCurrentSlot(
    slotRows.filter((slot) => !slot.disabled),
    nowMs,
    timeZone,
  );

  if (!matchedSlot) {
    return { currentLesson: null, currentSlot: null };
  }

  const currentSlot = {
    _id: matchedSlot._id as Id<"timetableSlots">,
    day: matchedSlot.day,
    startTime: matchedSlot.startTime,
    endTime: matchedSlot.endTime,
    disabled: matchedSlot.disabled ?? false,
  };

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- week-bounded lessons
  const lessonRows = await ctx.db
    .query("timetableLessons")
    .withIndex("by_termId_year_week", (q) =>
      q.eq("termId", activeTerm._id).eq("year", year).eq("weekNumber", weekNumber),
    )
    .collect();

  const lessonRow = lessonRows.find((lesson) => lesson.slotId === currentSlot._id);
  if (!lessonRow) {
    return { currentLesson: null, currentSlot };
  }

  const subject = await ctx.db.get("timetableSubjects", lessonRow.subjectId);
  if (!subject) {
    return { currentLesson: null, currentSlot };
  }

  const { events } = await loadClassCalendarEvents(ctx, classId);
  return {
    currentSlot,
    currentLesson: await mapLessonDisplay(ctx, lessonRow, subject, currentSlot, timeZone, events),
  };
}

const screenBundleValidator = v.object({
  settings: settingsValidator,
  displaySession: displaySessionValidator,
  timers: v.array(timerValidator),
  audioFiles: v.array(audioFileValidator),
  slots: v.array(slotDisplayValidator),
  lessons: v.array(lessonDisplayValidator),
  disabledSlotIds: v.array(v.id("timetableSlots")),
  pushedLesson: v.union(lessonDisplayValidator, v.null()),
});

type ScreenBundleDto = Infer<typeof screenBundleValidator>;

async function loadTimetableSnapshot(ctx: QueryCtx | MutationCtx, classId: Id<"classes">) {
  const { timeZone, events } = await loadClassCalendarEvents(ctx, classId);
  const todayKey = utcMsToZonedParts(Date.now(), timeZone).dateKey;
  const { year, weekNumber } = getIsoWeekYearAndNumberFromDateKey(todayKey);

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
  const terms = await ctx.db
    .query("timetableTerms")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();

  const activeTerm =
    terms.find((term) => term.startDateKey <= todayKey && term.endDateKey >= todayKey) ??
    terms[0] ??
    null;

  if (!activeTerm) {
    return {
      slots: [] as Array<{
        _id: Id<"timetableSlots">;
        day: string;
        startTime: string;
        endTime: string;
        disabled: boolean;
      }>,
      lessons: [] as Array<Infer<typeof lessonDisplayValidator>>,
      disabledSlotIds: [] as Array<Id<"timetableSlots">>,
    };
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- term-bounded slots
  const slots = await ctx.db
    .query("timetableSlots")
    .withIndex("by_termId", (q) => q.eq("termId", activeTerm._id))
    .collect();

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
  const subjects = await ctx.db
    .query("timetableSubjects")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  const subjectById = new Map(subjects.map((subject) => [subject._id, subject]));

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- week-bounded lessons
  const lessonRows = await ctx.db
    .query("timetableLessons")
    .withIndex("by_termId_year_week", (q) =>
      q.eq("termId", activeTerm._id).eq("year", year).eq("weekNumber", weekNumber),
    )
    .collect();

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- week-bounded disables
  const disables = await ctx.db
    .query("timetableSlotDisables")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();

  const disabledSlotIds = disables
    .filter((row) => row.year === year && row.weekNumber === weekNumber)
    .map((row) => row.slotId);

  const disabledSet = new Set(disabledSlotIds);
  const globalDisabled = new Set(slots.filter((slot) => slot.disabled).map((slot) => slot._id));

  const slotById = new Map(slots.map((slot) => [slot._id, slot]));
  const lessons = (
    await Promise.all(
      lessonRows.map(async (lesson) => {
        const subject = subjectById.get(lesson.subjectId);
        if (!subject) return null;
        return await mapLessonDisplay(
          ctx,
          lesson,
          subject,
          slotById.get(lesson.slotId),
          timeZone,
          events,
        );
      }),
    )
  ).filter((lesson) => lesson !== null);

  return {
    slots: slots.map((slot) => ({
      _id: slot._id,
      day: slot.day,
      startTime: slot.startTime,
      endTime: slot.endTime,
      disabled: slot.disabled || disabledSet.has(slot._id) || globalDisabled.has(slot._id),
    })),
    lessons,
    disabledSlotIds: [...new Set([...disabledSlotIds, ...globalDisabled])],
  };
}

async function mapPushedLesson(
  ctx: QueryCtx | MutationCtx,
  lessonId: Id<"timetableLessons"> | undefined,
) {
  if (!lessonId) return null;
  const lesson = await ctx.db.get("timetableLessons", lessonId);
  if (!lesson) return null;
  const subject = await ctx.db.get("timetableSubjects", lesson.subjectId);
  if (!subject) return null;
  const slot = await ctx.db.get("timetableSlots", lesson.slotId);
  const { timeZone, events } = await loadClassCalendarEvents(ctx, lesson.classId);
  return await mapLessonDisplay(ctx, lesson, subject, slot ?? undefined, timeZone, events);
}

export const getSettings = classQuery({
  args: {},
  returns: settingsValidator,
  handler: async (ctx): Promise<ClockSettingsDto> => {
    await ctx.require("classroomScreen:read");
    const classId = ctx.classDoc._id;
    const existing = await ctx.db
      .query("classroomClockSettings")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .unique();
    if (existing) return existing;
    const defaults: ClockSettingsDto = {
      classId,
      ...DEFAULT_CLOCK_SETTINGS,
      updatedAt: 0,
    };
    return defaults;
  },
});

export const getDisplayBundle = classQuery({
  args: {
    nowMinuteBucket: v.number(),
  },
  returns: displayBundleValidator,
  handler: async (ctx, args): Promise<DisplayBundleDto> => {
    await ctx.require("classroomScreen:read");
    const classId = ctx.classDoc._id;

    const settingsRow = await ctx.db
      .query("classroomClockSettings")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .unique();

    const settings: ClockSettingsDto = settingsRow ?? {
      classId,
      ...DEFAULT_CLOCK_SETTINGS,
      updatedAt: 0,
    };

    const displayRow = await ctx.db
      .query("classroomDisplaySessions")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .unique();

    const displaySession: DisplaySessionDto = displayRow ?? {
      classId,
      paused: false,
      updatedAt: 0,
    };

    const pushedLesson = await mapPushedLesson(ctx, displayRow?.pushedLessonId);
    const { currentLesson, currentSlot } = await loadCurrentLessonSnapshot(
      ctx,
      classId,
      args.nowMinuteBucket * 60_000,
    );

    return {
      settings,
      displaySession,
      pushedLesson,
      currentLesson,
      currentSlot,
    };
  },
});

export const getScreenBundle = classQuery({
  args: {},
  returns: screenBundleValidator,
  handler: async (ctx): Promise<ScreenBundleDto> => {
    await ctx.require("classroomScreen:read");
    const classId = ctx.classDoc._id;

    const settingsRow = await ctx.db
      .query("classroomClockSettings")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .unique();

    const settings: ClockSettingsDto = settingsRow ?? {
      classId,
      ...DEFAULT_CLOCK_SETTINGS,
      updatedAt: 0,
    };

    const displayRow = await ctx.db
      .query("classroomDisplaySessions")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .unique();

    const displaySession: DisplaySessionDto = displayRow ?? {
      classId,
      paused: false,
      updatedAt: 0,
    };

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    const timers = await ctx.db
      .query("classroomTimers")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();

    const audioFiles = await mapAudioFiles(ctx, classId);
    const timetable = await loadTimetableSnapshot(ctx, classId);
    const pushedLesson = await mapPushedLesson(ctx, displayRow?.pushedLessonId);

    return {
      settings,
      displaySession,
      timers: timers.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
      audioFiles,
      slots: timetable.slots,
      lessons: timetable.lessons,
      disabledSlotIds: timetable.disabledSlotIds,
      pushedLesson,
    };
  },
});

export const listTimers = classQuery({
  args: {},
  returns: v.array(timerValidator),
  handler: async (ctx) => {
    await ctx.require("classroomScreen:read");
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    const timers = await ctx.db
      .query("classroomTimers")
      .withIndex("by_classId", (q) => q.eq("classId", ctx.classDoc._id))
      .collect();
    return timers.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  },
});

export const listRotations = classQuery({
  args: {},
  returns: v.array(rotationValidator),
  handler: async (ctx) => {
    await ctx.require("classroomScreen:read");
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    const rotations = await ctx.db
      .query("classroomRotations")
      .withIndex("by_classId", (q) => q.eq("classId", ctx.classDoc._id))
      .collect();
    return rotations.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  },
});

export const listAudioFiles = classQuery({
  args: {},
  returns: v.array(audioFileValidator),
  handler: async (ctx) => {
    await ctx.require("classroomScreen:read");
    return await mapAudioFiles(ctx, ctx.classDoc._id);
  },
});

export const upsertSettings = classMutation({
  args: {
    clockSize: v.optional(v.number()),
    dateSize: v.optional(v.number()),
    clockBgColor: v.optional(v.string()),
    timerBgColor: v.optional(v.string()),
    dateLocation: v.optional(v.union(v.literal("above"), v.literal("below"))),
    timeFormat: v.optional(v.union(v.literal("12h"), v.literal("24h"))),
    currentTimeSize: v.optional(v.number()),
    endTimeSize: v.optional(v.number()),
    timerTitleSize: v.optional(v.number()),
    timerEndBehavior: v.optional(
      v.union(v.literal("countUp"), v.literal("hold"), v.literal("return")),
    ),
    overtimeAutoDismissSeconds: v.optional(v.number()),
    bgTransition: v.optional(v.string()),
    audioCues: audioCuesValidator,
    displayContentFontSize: v.optional(v.number()),
    displayHeadingFontSize: v.optional(v.number()),
    quickText: v.optional(v.string()),
    quickTextTitle: v.optional(v.string()),
  },
  returns: v.id("classroomClockSettings"),
  handler: async (ctx, args) => {
    await ctx.require("classroomScreen:manage");
    const classId = ctx.classDoc._id;
    const existing = await getOrCreateSettings(ctx, classId);
    const now = Date.now();

    const quickText =
      args.quickText === undefined
        ? existing.quickText
        : args.quickText.trim().slice(0, MAX_QUICK_TEXT_LENGTH) || undefined;

    await ctx.db.patch("classroomClockSettings", existing._id, {
      clockSize: args.clockSize ?? existing.clockSize,
      dateSize: args.dateSize ?? existing.dateSize,
      clockBgColor: args.clockBgColor ?? existing.clockBgColor,
      timerBgColor: args.timerBgColor ?? existing.timerBgColor,
      dateLocation: args.dateLocation ?? existing.dateLocation,
      timeFormat: args.timeFormat ?? existing.timeFormat,
      currentTimeSize: args.currentTimeSize ?? existing.currentTimeSize,
      endTimeSize: args.endTimeSize ?? existing.endTimeSize,
      timerTitleSize: args.timerTitleSize ?? existing.timerTitleSize,
      timerEndBehavior: args.timerEndBehavior ?? existing.timerEndBehavior,
      overtimeAutoDismissSeconds:
        args.overtimeAutoDismissSeconds ?? existing.overtimeAutoDismissSeconds,
      bgTransition: args.bgTransition ?? existing.bgTransition,
      audioCues: args.audioCues ?? existing.audioCues,
      displayContentFontSize: args.displayContentFontSize ?? existing.displayContentFontSize,
      displayHeadingFontSize: args.displayHeadingFontSize ?? existing.displayHeadingFontSize,
      quickText,
      quickTextTitle: args.quickTextTitle ?? existing.quickTextTitle,
      updatedAt: now,
    });

    return existing._id;
  },
});

export const createTimer = classMutation({
  args: {
    name: v.string(),
    durationSeconds: v.number(),
    bgColor: v.string(),
    endTime: v.optional(v.string()),
    bgTransition: v.optional(v.string()),
    audioCues: audioCuesValidator,
    nextTimerId: v.optional(v.id("classroomTimers")),
  },
  returns: v.id("classroomTimers"),
  handler: async (ctx, args) => {
    await ctx.require("classroomScreen:manage");
    const classId = ctx.classDoc._id;
    const name = normalizeName(args.name);
    const endTime = normalizeOptionalEndTime(args.endTime);
    const durationSeconds = endTime
      ? secondsUntilEndTime(endTime)
      : normalizeDurationSeconds(args.durationSeconds);

    if (args.nextTimerId) {
      await requireTimerInClass(ctx, classId, args.nextTimerId);
    }

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    const existing = await ctx.db
      .query("classroomTimers")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();
    const sortOrder = existing.reduce((max, timer) => Math.max(max, timer.sortOrder), -1) + 1;
    const now = Date.now();

    return await ctx.db.insert("classroomTimers", {
      classId,
      name,
      durationSeconds,
      bgColor: args.bgColor,
      endTime,
      bgTransition: args.bgTransition,
      audioCues: args.audioCues,
      nextTimerId: args.nextTimerId,
      sortOrder,
      createdBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateTimer = classMutation({
  args: {
    timerId: v.id("classroomTimers"),
    name: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
    bgColor: v.optional(v.string()),
    endTime: v.optional(v.string()),
    bgTransition: v.optional(v.string()),
    audioCues: audioCuesValidator,
    nextTimerId: v.optional(v.union(v.id("classroomTimers"), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("classroomScreen:manage");
    const classId = ctx.classDoc._id;
    const timer = await requireTimerInClass(ctx, classId, args.timerId);

    if (args.nextTimerId) {
      if (args.nextTimerId === args.timerId) {
        throw new Error("A timer cannot chain to itself");
      }
      await requireTimerInClass(ctx, classId, args.nextTimerId);
    }

    const endTime =
      args.endTime === undefined ? timer.endTime : normalizeOptionalEndTime(args.endTime);
    const durationSeconds =
      endTime !== undefined
        ? secondsUntilEndTime(endTime)
        : args.durationSeconds !== undefined
          ? normalizeDurationSeconds(args.durationSeconds)
          : timer.durationSeconds;

    await ctx.db.patch("classroomTimers", timer._id, {
      name: args.name !== undefined ? normalizeName(args.name) : timer.name,
      durationSeconds,
      bgColor: args.bgColor ?? timer.bgColor,
      endTime,
      bgTransition: args.bgTransition ?? timer.bgTransition,
      audioCues: args.audioCues ?? timer.audioCues,
      nextTimerId:
        args.nextTimerId === null
          ? undefined
          : args.nextTimerId !== undefined
            ? args.nextTimerId
            : timer.nextTimerId,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const deleteTimer = classMutation({
  args: { timerId: v.id("classroomTimers") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("classroomScreen:manage");
    const classId = ctx.classDoc._id;
    await requireTimerInClass(ctx, classId, args.timerId);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    const timers = await ctx.db
      .query("classroomTimers")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();

    for (const timer of timers) {
      if (timer.nextTimerId === args.timerId) {
        await ctx.db.patch("classroomTimers", timer._id, {
          nextTimerId: undefined,
          updatedAt: Date.now(),
        });
      }
    }

    await ctx.db.delete("classroomTimers", args.timerId);
    return null;
  },
});

export const createRotation = classMutation({
  args: {
    name: v.string(),
    rotationDurationSeconds: v.number(),
    numberOfRotations: v.number(),
    transitionDurationSeconds: v.number(),
    rotationBgColor: v.string(),
    transitionBgColor: v.string(),
    finalTransition: v.optional(v.boolean()),
    bgTransition: v.optional(v.string()),
    audioCues: audioCuesValidator,
    workCues: audioCuesValidator,
    transitionCues: audioCuesValidator,
  },
  returns: v.id("classroomRotations"),
  handler: async (ctx, args) => {
    await ctx.require("classroomScreen:manage");
    const classId = ctx.classDoc._id;
    const parsed = parseRotationInput({
      name: args.name,
      rotationDurationSeconds: args.rotationDurationSeconds,
      numberOfRotations: args.numberOfRotations,
      transitionDurationSeconds: args.transitionDurationSeconds,
      rotationBgColor: args.rotationBgColor,
      transitionBgColor: args.transitionBgColor,
      finalTransition: args.finalTransition ?? false,
      bgTransition: args.bgTransition,
      audioCues: args.audioCues,
      workCues: args.workCues,
      transitionCues: args.transitionCues,
    });

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    const existing = await ctx.db
      .query("classroomRotations")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();
    const sortOrder = existing.reduce((max, rotation) => Math.max(max, rotation.sortOrder), -1) + 1;
    const now = Date.now();

    const rotationId = await ctx.db.insert("classroomRotations", {
      classId,
      name: parsed.name,
      rotationDurationSeconds: parsed.rotationDurationSeconds,
      numberOfRotations: parsed.numberOfRotations,
      transitionDurationSeconds: parsed.transitionDurationSeconds,
      rotationBgColor: parsed.rotationBgColor,
      transitionBgColor: parsed.transitionBgColor,
      finalTransition: parsed.finalTransition,
      bgTransition: parsed.bgTransition,
      audioCues: parsed.audioCues,
      workCues: parsed.workCues,
      transitionCues: parsed.transitionCues,
      sortOrder,
      createdBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "classroomRotation",
      resourceId: rotationId,
      summary: `Created rotation "${parsed.name}"`,
      summaryKey: "activitySummary_createdRotation",
      metadata: { name: parsed.name },
    });

    return rotationId;
  },
});

export const updateRotation = classMutation({
  args: {
    rotationId: v.id("classroomRotations"),
    name: v.string(),
    rotationDurationSeconds: v.number(),
    numberOfRotations: v.number(),
    transitionDurationSeconds: v.number(),
    rotationBgColor: v.string(),
    transitionBgColor: v.string(),
    finalTransition: v.optional(v.boolean()),
    bgTransition: v.optional(v.union(v.string(), v.null())),
    audioCues: audioCuesValidator,
    workCues: audioCuesValidator,
    transitionCues: audioCuesValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("classroomScreen:manage");
    const classId = ctx.classDoc._id;
    const rotation = await requireRotationInClass(ctx, classId, args.rotationId);
    const parsed = parseRotationInput({
      name: args.name,
      rotationDurationSeconds: args.rotationDurationSeconds,
      numberOfRotations: args.numberOfRotations,
      transitionDurationSeconds: args.transitionDurationSeconds,
      rotationBgColor: args.rotationBgColor,
      transitionBgColor: args.transitionBgColor,
      finalTransition: args.finalTransition ?? false,
      bgTransition: args.bgTransition === null ? undefined : args.bgTransition,
      audioCues: args.audioCues,
      workCues: args.workCues,
      transitionCues: args.transitionCues,
    });

    await ctx.db.patch("classroomRotations", rotation._id, {
      name: parsed.name,
      rotationDurationSeconds: parsed.rotationDurationSeconds,
      numberOfRotations: parsed.numberOfRotations,
      transitionDurationSeconds: parsed.transitionDurationSeconds,
      rotationBgColor: parsed.rotationBgColor,
      transitionBgColor: parsed.transitionBgColor,
      finalTransition: parsed.finalTransition,
      bgTransition: parsed.bgTransition,
      audioCues: parsed.audioCues,
      workCues: parsed.workCues,
      transitionCues: parsed.transitionCues,
      updatedAt: Date.now(),
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "classroomRotation",
      resourceId: rotation._id,
      summary: `Updated rotation "${parsed.name}"`,
      summaryKey: "activitySummary_updatedRotation",
      metadata: { name: parsed.name },
    });
    return null;
  },
});

export const deleteRotation = classMutation({
  args: { rotationId: v.id("classroomRotations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("classroomScreen:manage");
    const classId = ctx.classDoc._id;
    const rotation = await requireRotationInClass(ctx, classId, args.rotationId);
    const name = rotation.name;
    await ctx.db.delete("classroomRotations", args.rotationId);

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "classroomRotation",
      resourceId: args.rotationId,
      summary: `Deleted rotation "${name}"`,
      summaryKey: "activitySummary_deletedRotation",
      metadata: { name },
    });
    return null;
  },
});

export const registerAudioFile = classMutation({
  args: {
    fileId: v.id("files"),
    name: v.optional(v.string()),
  },
  returns: v.id("classroomAudioFiles"),
  handler: async (ctx, args) => {
    await ctx.require("classroomScreen:manage");
    const classId = ctx.classDoc._id;
    const file = await ctx.db.get("files", args.fileId);
    if (!file || file.classId !== classId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "File not found in this class" });
    }
    if (file.preset !== "audio") {
      throw new Error("File must use the audio upload preset");
    }

    const now = Date.now();
    return await ctx.db.insert("classroomAudioFiles", {
      classId,
      name: normalizeName(args.name ?? file.name.replace(/\.[^.]+$/, "")),
      fileId: file._id,
      contentType: file.contentType,
      size: file.size,
      createdBy: ctx.userId,
      createdAt: now,
    });
  },
});

export const deleteAudioFile = classMutation({
  args: { audioFileId: v.id("classroomAudioFiles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("classroomScreen:manage");
    const audio = await requireAudioInClass(ctx, ctx.classDoc._id, args.audioFileId);
    await ctx.db.delete("classroomAudioFiles", audio._id);
    return null;
  },
});

async function patchDisplaySession(
  ctx: MutationCtx,
  classId: Id<"classes">,
  patch: Partial<Doc<"classroomDisplaySessions">>,
) {
  const session = await getOrCreateDisplaySession(ctx, classId);
  await ctx.db.patch("classroomDisplaySessions", session._id, {
    ...patch,
    updatedAt: Date.now(),
  });
}

export const startSession = classMutation({
  args: { session: v.any() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("classroomScreen:manage");
    const classId = ctx.classDoc._id;
    const parsed = parseSessionJson(args.session);
    if (!parsed) throw new Error("Invalid session payload");

    const duration = resolveSegmentDuration(parsed.segments[parsed.index]!);
    await patchDisplaySession(ctx, classId, {
      sessionJson: serializeSession(parsed),
      endsAt: Date.now() + duration * 1000,
      paused: false,
      pausedRemainingMs: undefined,
    });
    return null;
  },
});

export const stopSession = classMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.require("classroomScreen:manage");
    await patchDisplaySession(ctx, ctx.classDoc._id, {
      sessionJson: undefined,
      endsAt: undefined,
      paused: false,
      pausedRemainingMs: undefined,
    });
    return null;
  },
});

export const pauseSession = classMutation({
  args: { remainingMs: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("classroomScreen:manage");
    if (args.remainingMs < 0) throw new Error("Remaining time cannot be negative");
    await patchDisplaySession(ctx, ctx.classDoc._id, {
      paused: true,
      pausedRemainingMs: args.remainingMs,
      endsAt: undefined,
    });
    return null;
  },
});

export const resumeSession = classMutation({
  args: { remainingMs: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("classroomScreen:manage");
    if (args.remainingMs < 0) throw new Error("Remaining time cannot be negative");
    await patchDisplaySession(ctx, ctx.classDoc._id, {
      paused: false,
      pausedRemainingMs: undefined,
      endsAt: Date.now() + args.remainingMs,
    });
    return null;
  },
});

export const adjustSession = classMutation({
  args: { deltaSeconds: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("classroomScreen:manage");
    const classId = ctx.classDoc._id;
    const session = await getOrCreateDisplaySession(ctx, classId);

    if (session.paused && session.pausedRemainingMs !== undefined) {
      const nextMs = session.pausedRemainingMs + args.deltaSeconds * 1000;
      if (nextMs < 0) return null;
      await patchDisplaySession(ctx, classId, { pausedRemainingMs: nextMs });
      return null;
    }

    if (session.endsAt === undefined) return null;
    const nextEndsAt = session.endsAt + args.deltaSeconds * 1000;
    const nextRemaining = Math.floor((nextEndsAt - Date.now()) / 1000);
    if (nextRemaining < 0) return null;

    await patchDisplaySession(ctx, classId, { endsAt: nextEndsAt });
    return null;
  },
});

export const updateSession = classMutation({
  args: { session: v.any() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("classroomScreen:manage");
    const parsed = parseSessionJson(args.session);
    if (!parsed) throw new Error("Invalid session payload");

    await patchDisplaySession(ctx, ctx.classDoc._id, {
      sessionJson: serializeSession(parsed),
    });
    return null;
  },
});

export const skipSessionSegment = classMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.require("classroomScreen:manage");
    const classId = ctx.classDoc._id;
    const row = await getOrCreateDisplaySession(ctx, classId);
    const parsed = parseSessionJson(row.sessionJson);
    if (!parsed) return null;

    const next = advanceSegment(parsed);
    if (!next) {
      await patchDisplaySession(ctx, classId, {
        sessionJson: undefined,
        endsAt: undefined,
        paused: false,
        pausedRemainingMs: undefined,
      });
      return null;
    }

    const duration = resolveSegmentDuration(next.segments[next.index]!);
    await patchDisplaySession(ctx, classId, {
      sessionJson: serializeSession(next),
      endsAt: Date.now() + duration * 1000,
      paused: false,
      pausedRemainingMs: undefined,
    });
    return null;
  },
});

export const pushLessonToDisplay = classMutation({
  args: {
    lessonId: v.id("timetableLessons"),
    durationSeconds: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("classroomScreen:manage");
    const lesson = await ctx.db.get("timetableLessons", args.lessonId);
    if (!lesson || lesson.classId !== ctx.classDoc._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Lesson not found" });
    }
    const duration = normalizeDurationSeconds(args.durationSeconds);
    await patchDisplaySession(ctx, ctx.classDoc._id, {
      pushedLessonId: lesson._id,
      pushedUntil: Date.now() + duration * 1000,
    });
    return null;
  },
});

export const clearPushedLesson = classMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.require("classroomScreen:manage");
    await patchDisplaySession(ctx, ctx.classDoc._id, {
      pushedLessonId: undefined,
      pushedUntil: undefined,
    });
    return null;
  },
});

export const clearQuickText = classMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.require("classroomScreen:manage");
    const settings = await getOrCreateSettings(ctx, ctx.classDoc._id);
    await ctx.db.patch("classroomClockSettings", settings._id, {
      quickText: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export type { ActiveSession };
