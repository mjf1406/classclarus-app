import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel.js";
import { classMutation, classQuery } from "./lib/auth/customFunctions.js";
import {
  lessonLinkValidator,
  normalizeDateRange,
  normalizeDays,
  normalizeHexColor,
  normalizeLessonLinks,
  normalizeSlotTimes,
  normalizeSubjectName,
  normalizeTermName,
  normalizeTimeRange,
  termKindValidator,
  MAX_NOTES_JSON_LENGTH,
  type LessonLinkInput,
} from "./lib/timetable/timetableSchema.js";

const termValidator = v.object({
  _id: v.id("timetableTerms"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  name: v.string(),
  kind: termKindValidator,
  startDateKey: v.string(),
  endDateKey: v.string(),
  days: v.array(v.string()),
  startTime: v.string(),
  endTime: v.string(),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const slotValidator = v.object({
  _id: v.id("timetableSlots"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  termId: v.id("timetableTerms"),
  day: v.string(),
  startTime: v.string(),
  endTime: v.string(),
  disabled: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const subjectValidator = v.object({
  _id: v.id("timetableSubjects"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  name: v.string(),
  bgColor: v.string(),
  textColor: v.string(),
  iconName: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const lessonValidator = v.object({
  _id: v.id("timetableLessons"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  termId: v.id("timetableTerms"),
  slotId: v.id("timetableSlots"),
  subjectId: v.id("timetableSubjects"),
  year: v.number(),
  weekNumber: v.number(),
  notesJson: v.optional(v.string()),
  complete: v.boolean(),
  links: v.array(lessonLinkValidator),
  createdAt: v.number(),
  updatedAt: v.number(),
  subject: subjectValidator,
});

const weekBundleValidator = v.object({
  term: termValidator,
  slots: v.array(slotValidator),
  subjects: v.array(subjectValidator),
  lessons: v.array(lessonValidator),
  disabledSlotIds: v.array(v.id("timetableSlots")),
});

async function assertTermBelongsToClass(
  ctx: {
    db: {
      get: (
        table: "timetableTerms",
        id: Id<"timetableTerms">,
      ) => Promise<Doc<"timetableTerms"> | null>;
    };
  },
  classId: Id<"classes">,
  termId: Id<"timetableTerms">,
): Promise<Doc<"timetableTerms">> {
  const term = await ctx.db.get("timetableTerms", termId);
  if (!term || term.classId !== classId) {
    throw new ConvexError({ message: "Term not found" });
  }
  return term;
}

async function assertSlotBelongsToClass(
  ctx: {
    db: {
      get: (
        table: "timetableSlots",
        id: Id<"timetableSlots">,
      ) => Promise<Doc<"timetableSlots"> | null>;
    };
  },
  classId: Id<"classes">,
  slotId: Id<"timetableSlots">,
): Promise<Doc<"timetableSlots">> {
  const slot = await ctx.db.get("timetableSlots", slotId);
  if (!slot || slot.classId !== classId) {
    throw new ConvexError({ message: "Slot not found" });
  }
  return slot;
}

async function assertSubjectBelongsToClass(
  ctx: {
    db: {
      get: (
        table: "timetableSubjects",
        id: Id<"timetableSubjects">,
      ) => Promise<Doc<"timetableSubjects"> | null>;
    };
  },
  classId: Id<"classes">,
  subjectId: Id<"timetableSubjects">,
): Promise<Doc<"timetableSubjects">> {
  const subject = await ctx.db.get("timetableSubjects", subjectId);
  if (!subject || subject.classId !== classId) {
    throw new ConvexError({ message: "Subject not found" });
  }
  return subject;
}

export const listTerms = classQuery({
  args: {},
  returns: v.array(termValidator),
  handler: async (ctx) => {
    await ctx.require("timetable:read");
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    return await ctx.db
      .query("timetableTerms")
      .withIndex("by_classId", (q) => q.eq("classId", ctx.classDoc._id))
      .collect();
  },
});

export const getWeekBundle = classQuery({
  args: {
    termId: v.id("timetableTerms"),
    year: v.number(),
    weekNumber: v.number(),
  },
  returns: weekBundleValidator,
  handler: async (ctx, args) => {
    await ctx.require("timetable:read");
    const term = await assertTermBelongsToClass(ctx, ctx.classDoc._id, args.termId);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- term-bounded slots
    const slots = await ctx.db
      .query("timetableSlots")
      .withIndex("by_termId", (q) => q.eq("termId", args.termId))
      .collect();

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    const subjects = await ctx.db
      .query("timetableSubjects")
      .withIndex("by_classId", (q) => q.eq("classId", ctx.classDoc._id))
      .collect();

    const subjectById = new Map(subjects.map((s) => [s._id, s]));

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- week-bounded lessons
    const lessonRows = await ctx.db
      .query("timetableLessons")
      .withIndex("by_termId_year_week", (q) =>
        q.eq("termId", args.termId).eq("year", args.year).eq("weekNumber", args.weekNumber),
      )
      .collect();

    const lessons = lessonRows
      .map((lesson) => {
        const subject = subjectById.get(lesson.subjectId);
        if (!subject) return null;
        return { ...lesson, subject };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const disabledSlotIds: Array<Id<"timetableSlots">> = [];
    for (const slot of slots) {
      const disable = await ctx.db
        .query("timetableSlotDisables")
        .withIndex("by_slotId_year_week", (q) =>
          q.eq("slotId", slot._id).eq("year", args.year).eq("weekNumber", args.weekNumber),
        )
        .unique();
      if (disable) disabledSlotIds.push(slot._id);
    }

    return {
      term,
      slots,
      subjects,
      lessons,
      disabledSlotIds,
    };
  },
});

export const createTerm = classMutation({
  args: {
    name: v.string(),
    kind: termKindValidator,
    startDateKey: v.string(),
    endDateKey: v.string(),
    days: v.array(v.string()),
    startTime: v.string(),
    endTime: v.string(),
    copySlotsFromTermId: v.optional(v.id("timetableTerms")),
  },
  returns: v.id("timetableTerms"),
  handler: async (ctx, args) => {
    await ctx.require("timetable:manage");
    const name = normalizeTermName(args.name);
    const dates = normalizeDateRange(args.startDateKey, args.endDateKey);
    const days = normalizeDays(args.days);
    const times = normalizeTimeRange(args.startTime, args.endTime);
    const now = Date.now();

    const termId = await ctx.db.insert("timetableTerms", {
      classId: ctx.classDoc._id,
      name,
      kind: args.kind,
      startDateKey: dates.startDateKey,
      endDateKey: dates.endDateKey,
      days,
      startTime: times.startTime,
      endTime: times.endTime,
      createdBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    });

    if (args.copySlotsFromTermId) {
      const sourceTerm = await assertTermBelongsToClass(
        ctx,
        ctx.classDoc._id,
        args.copySlotsFromTermId,
      );
      // eslint-disable-next-line @convex-dev/no-collect-in-query -- term-bounded slots
      const sourceSlots = await ctx.db
        .query("timetableSlots")
        .withIndex("by_termId", (q) => q.eq("termId", sourceTerm._id))
        .collect();
      for (const slot of sourceSlots) {
        await ctx.db.insert("timetableSlots", {
          classId: ctx.classDoc._id,
          termId,
          day: slot.day,
          startTime: slot.startTime,
          endTime: slot.endTime,
          disabled: slot.disabled,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return termId;
  },
});

export const updateTerm = classMutation({
  args: {
    termId: v.id("timetableTerms"),
    name: v.string(),
    kind: termKindValidator,
    startDateKey: v.string(),
    endDateKey: v.string(),
    days: v.array(v.string()),
    startTime: v.string(),
    endTime: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("timetable:manage");
    await assertTermBelongsToClass(ctx, ctx.classDoc._id, args.termId);
    const name = normalizeTermName(args.name);
    const dates = normalizeDateRange(args.startDateKey, args.endDateKey);
    const days = normalizeDays(args.days);
    const times = normalizeTimeRange(args.startTime, args.endTime);
    await ctx.db.patch("timetableTerms", args.termId, {
      name,
      kind: args.kind,
      startDateKey: dates.startDateKey,
      endDateKey: dates.endDateKey,
      days,
      startTime: times.startTime,
      endTime: times.endTime,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const removeTerm = classMutation({
  args: { termId: v.id("timetableTerms") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("timetable:manage");
    await assertTermBelongsToClass(ctx, ctx.classDoc._id, args.termId);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- term-bounded cleanup
    const lessons = await ctx.db
      .query("timetableLessons")
      .withIndex("by_termId_year_week", (q) => q.eq("termId", args.termId))
      .collect();
    for (const lesson of lessons) {
      await ctx.db.delete("timetableLessons", lesson._id);
    }

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- term-bounded cleanup
    const slots = await ctx.db
      .query("timetableSlots")
      .withIndex("by_termId", (q) => q.eq("termId", args.termId))
      .collect();
    for (const slot of slots) {
      // eslint-disable-next-line @convex-dev/no-collect-in-query -- slot-bounded cleanup
      const disables = await ctx.db
        .query("timetableSlotDisables")
        .withIndex("by_slotId_year_week", (q) => q.eq("slotId", slot._id))
        .collect();
      for (const disable of disables) {
        await ctx.db.delete("timetableSlotDisables", disable._id);
      }
      await ctx.db.delete("timetableSlots", slot._id);
    }

    await ctx.db.delete("timetableTerms", args.termId);
    return null;
  },
});

export const createSlot = classMutation({
  args: {
    termId: v.id("timetableTerms"),
    day: v.string(),
    startTime: v.string(),
    endTime: v.string(),
  },
  returns: v.id("timetableSlots"),
  handler: async (ctx, args) => {
    await ctx.require("timetable:manage");
    const term = await assertTermBelongsToClass(ctx, ctx.classDoc._id, args.termId);
    if (!term.days.includes(args.day)) {
      throw new Error("Day is not in this term");
    }
    const times = normalizeSlotTimes(args.startTime, args.endTime);
    const now = Date.now();
    return await ctx.db.insert("timetableSlots", {
      classId: ctx.classDoc._id,
      termId: args.termId,
      day: args.day,
      startTime: times.startTime,
      endTime: times.endTime,
      disabled: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateSlot = classMutation({
  args: {
    slotId: v.id("timetableSlots"),
    day: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    disabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("timetable:manage");
    const slot = await assertSlotBelongsToClass(ctx, ctx.classDoc._id, args.slotId);
    const term = await assertTermBelongsToClass(ctx, ctx.classDoc._id, slot.termId);
    if (!term.days.includes(args.day)) {
      throw new Error("Day is not in this term");
    }
    const times = normalizeSlotTimes(args.startTime, args.endTime);
    await ctx.db.patch("timetableSlots", args.slotId, {
      day: args.day,
      startTime: times.startTime,
      endTime: times.endTime,
      disabled: args.disabled,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const removeSlot = classMutation({
  args: { slotId: v.id("timetableSlots") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("timetable:manage");
    await assertSlotBelongsToClass(ctx, ctx.classDoc._id, args.slotId);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- slot-bounded cleanup
    const lessons = await ctx.db
      .query("timetableLessons")
      .withIndex("by_slotId_year_week", (q) => q.eq("slotId", args.slotId))
      .collect();
    for (const lesson of lessons) {
      await ctx.db.delete("timetableLessons", lesson._id);
    }

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- slot-bounded cleanup
    const disables = await ctx.db
      .query("timetableSlotDisables")
      .withIndex("by_slotId_year_week", (q) => q.eq("slotId", args.slotId))
      .collect();
    for (const disable of disables) {
      await ctx.db.delete("timetableSlotDisables", disable._id);
    }

    await ctx.db.delete("timetableSlots", args.slotId);
    return null;
  },
});

export const createSubject = classMutation({
  args: {
    name: v.string(),
    bgColor: v.string(),
    textColor: v.string(),
    iconName: v.optional(v.string()),
  },
  returns: v.id("timetableSubjects"),
  handler: async (ctx, args) => {
    await ctx.require("timetable:manage");
    const name = normalizeSubjectName(args.name);
    const now = Date.now();
    return await ctx.db.insert("timetableSubjects", {
      classId: ctx.classDoc._id,
      name,
      bgColor: normalizeHexColor(args.bgColor, "#6366f1"),
      textColor: normalizeHexColor(args.textColor, "#ffffff"),
      iconName: args.iconName?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateSubject = classMutation({
  args: {
    subjectId: v.id("timetableSubjects"),
    name: v.string(),
    bgColor: v.string(),
    textColor: v.string(),
    iconName: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("timetable:manage");
    await assertSubjectBelongsToClass(ctx, ctx.classDoc._id, args.subjectId);
    const name = normalizeSubjectName(args.name);
    await ctx.db.patch("timetableSubjects", args.subjectId, {
      name,
      bgColor: normalizeHexColor(args.bgColor, "#6366f1"),
      textColor: normalizeHexColor(args.textColor, "#ffffff"),
      iconName: args.iconName?.trim() || undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const removeSubject = classMutation({
  args: { subjectId: v.id("timetableSubjects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("timetable:manage");
    await assertSubjectBelongsToClass(ctx, ctx.classDoc._id, args.subjectId);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- subject-bounded cleanup
    const lessons = await ctx.db
      .query("timetableLessons")
      .withIndex("by_subjectId", (q) => q.eq("subjectId", args.subjectId))
      .collect();
    for (const lesson of lessons) {
      await ctx.db.delete("timetableLessons", lesson._id);
    }

    await ctx.db.delete("timetableSubjects", args.subjectId);
    return null;
  },
});

export const upsertLesson = classMutation({
  args: {
    termId: v.id("timetableTerms"),
    slotId: v.id("timetableSlots"),
    subjectId: v.id("timetableSubjects"),
    year: v.number(),
    weekNumber: v.number(),
    notesJson: v.optional(v.string()),
    complete: v.boolean(),
    links: v.array(lessonLinkValidator),
  },
  returns: v.id("timetableLessons"),
  handler: async (ctx, args) => {
    await ctx.require("timetable:manage");
    await assertTermBelongsToClass(ctx, ctx.classDoc._id, args.termId);
    const slot = await assertSlotBelongsToClass(ctx, ctx.classDoc._id, args.slotId);
    if (slot.termId !== args.termId) throw new Error("Slot does not belong to this term");
    await assertSubjectBelongsToClass(ctx, ctx.classDoc._id, args.subjectId);

    const notesJson = args.notesJson?.trim();
    if (notesJson && notesJson.length > MAX_NOTES_JSON_LENGTH) {
      throw new Error(`Notes must be at most ${MAX_NOTES_JSON_LENGTH} characters`);
    }
    const links = await normalizeLessonLinks(
      ctx,
      ctx.classDoc._id,
      args.links as Array<LessonLinkInput>,
    );
    const now = Date.now();

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- slot-week lessons are few
    const existingRows = await ctx.db
      .query("timetableLessons")
      .withIndex("by_slotId_year_week", (q) =>
        q.eq("slotId", args.slotId).eq("year", args.year).eq("weekNumber", args.weekNumber),
      )
      .collect();
    const existing = existingRows.find((row) => row.subjectId === args.subjectId);

    if (existing) {
      await ctx.db.patch("timetableLessons", existing._id, {
        notesJson: notesJson || undefined,
        complete: args.complete,
        links,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("timetableLessons", {
      classId: ctx.classDoc._id,
      termId: args.termId,
      slotId: args.slotId,
      subjectId: args.subjectId,
      year: args.year,
      weekNumber: args.weekNumber,
      notesJson: notesJson || undefined,
      complete: args.complete,
      links,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const addLessonToSlot = classMutation({
  args: {
    termId: v.id("timetableTerms"),
    slotId: v.id("timetableSlots"),
    subjectId: v.id("timetableSubjects"),
    year: v.number(),
    weekNumber: v.number(),
  },
  returns: v.id("timetableLessons"),
  handler: async (ctx, args) => {
    await ctx.require("timetable:manage");
    await assertTermBelongsToClass(ctx, ctx.classDoc._id, args.termId);
    const slot = await assertSlotBelongsToClass(ctx, ctx.classDoc._id, args.slotId);
    if (slot.termId !== args.termId) throw new Error("Slot does not belong to this term");
    await assertSubjectBelongsToClass(ctx, ctx.classDoc._id, args.subjectId);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- slot-week lessons are few
    const existingRows = await ctx.db
      .query("timetableLessons")
      .withIndex("by_slotId_year_week", (q) =>
        q.eq("slotId", args.slotId).eq("year", args.year).eq("weekNumber", args.weekNumber),
      )
      .collect();
    const existing = existingRows.find((row) => row.subjectId === args.subjectId);
    if (existing) return existing._id;

    const now = Date.now();
    return await ctx.db.insert("timetableLessons", {
      classId: ctx.classDoc._id,
      termId: args.termId,
      slotId: args.slotId,
      subjectId: args.subjectId,
      year: args.year,
      weekNumber: args.weekNumber,
      complete: false,
      links: [],
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const removeLesson = classMutation({
  args: { lessonId: v.id("timetableLessons") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("timetable:manage");
    const lesson = await ctx.db.get("timetableLessons", args.lessonId);
    if (!lesson || lesson.classId !== ctx.classDoc._id) {
      throw new ConvexError({ message: "Lesson not found" });
    }
    await ctx.db.delete("timetableLessons", args.lessonId);
    return null;
  },
});

export const toggleSlotDisabledForWeek = classMutation({
  args: {
    slotId: v.id("timetableSlots"),
    year: v.number(),
    weekNumber: v.number(),
    disabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("timetable:manage");
    await assertSlotBelongsToClass(ctx, ctx.classDoc._id, args.slotId);

    const existing = await ctx.db
      .query("timetableSlotDisables")
      .withIndex("by_slotId_year_week", (q) =>
        q.eq("slotId", args.slotId).eq("year", args.year).eq("weekNumber", args.weekNumber),
      )
      .unique();

    if (args.disabled) {
      if (!existing) {
        await ctx.db.insert("timetableSlotDisables", {
          classId: ctx.classDoc._id,
          slotId: args.slotId,
          year: args.year,
          weekNumber: args.weekNumber,
          createdAt: Date.now(),
        });
      }
    } else if (existing) {
      await ctx.db.delete("timetableSlotDisables", existing._id);
    }
    return null;
  },
});
