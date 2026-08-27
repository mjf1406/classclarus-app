import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel.js";
import type { MutationCtx } from "./_generated/server.js";
import { recordClassActivity } from "./lib/activity/classActivity.js";
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
import {
  timetableSlotFormSchemaEn,
  timetableSubjectFormSchemaEn,
  timetableTermFormSchemaEn,
} from "./lib/timetable/timetableFormSchema.js";
import {
  buildMirrorLessonOps,
  planRepairGroupAfterSlotDelete,
  planSyncSlotLinkMembership,
  planUnlinkSlot,
  type LessonLinkLike,
  type MirrorLessonOp,
  type SlotLinkLike,
} from "./lib/timetable/slotLinks.js";

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
  linkGroupId: v.optional(v.string()),
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

async function listTermSlots(ctx: { db: MutationCtx["db"] }, termId: Id<"timetableTerms">) {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- term-bounded slots
  return await ctx.db
    .query("timetableSlots")
    .withIndex("by_termId", (q) => q.eq("termId", termId))
    .collect();
}

async function listWeekLessonsForTerm(
  ctx: { db: MutationCtx["db"] },
  termId: Id<"timetableTerms">,
  year: number,
  weekNumber: number,
) {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- week-bounded lessons
  return await ctx.db
    .query("timetableLessons")
    .withIndex("by_termId_year_week", (q) =>
      q.eq("termId", termId).eq("year", year).eq("weekNumber", weekNumber),
    )
    .collect();
}

async function applyMirrorLessonOps(
  ctx: MutationCtx,
  classId: Id<"classes">,
  termId: Id<"timetableTerms">,
  year: number,
  weekNumber: number,
  ops: Array<MirrorLessonOp>,
): Promise<void> {
  const now = Date.now();
  for (const op of ops) {
    if (op.op === "createLesson") {
      await ctx.db.insert("timetableLessons", {
        classId,
        termId,
        slotId: op.slotId,
        subjectId: op.subjectId,
        year,
        weekNumber,
        notesJson: op.notesJson,
        complete: op.complete,
        links: op.links,
        createdAt: now,
        updatedAt: now,
      });
      continue;
    }
    if (op.op === "updateLesson") {
      await ctx.db.patch("timetableLessons", op.lessonId, {
        notesJson: op.notesJson,
        complete: op.complete,
        links: op.links,
        updatedAt: now,
      });
      continue;
    }
    await ctx.db.delete("timetableLessons", op.lessonId);
  }
}

async function mirrorLessonChange(
  ctx: MutationCtx,
  classId: Id<"classes">,
  termId: Id<"timetableTerms">,
  year: number,
  weekNumber: number,
  change: Parameters<typeof buildMirrorLessonOps>[0],
): Promise<void> {
  const slots = await listTermSlots(ctx, termId);
  const lessons = await listWeekLessonsForTerm(ctx, termId, year, weekNumber);
  const ops = buildMirrorLessonOps(
    change,
    slots as Array<SlotLinkLike>,
    lessons as Array<LessonLinkLike>,
    year,
    weekNumber,
  );
  await applyMirrorLessonOps(ctx, classId, termId, year, weekNumber, ops);
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
    const parsed = timetableTermFormSchemaEn.safeParse({
      name: args.name,
      kind: args.kind,
      startDateKey: args.startDateKey,
      endDateKey: args.endDateKey,
      days: args.days,
      startTime: args.startTime,
      endTime: args.endTime,
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const name = normalizeTermName(parsed.data.name);
    const dates = normalizeDateRange(parsed.data.startDateKey, parsed.data.endDateKey);
    const days = normalizeDays(parsed.data.days);
    const times = normalizeTimeRange(parsed.data.startTime, parsed.data.endTime);
    const now = Date.now();

    const termId = await ctx.db.insert("timetableTerms", {
      classId: ctx.classDoc._id,
      name,
      kind: parsed.data.kind,
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

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "timetableTerm",
      resourceId: termId,
      summary: `Created timetable term "${name}"`,
      summaryKey: "activitySummary_createdTimetableTerm",
      metadata: { name },
    });

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
    const parsed = timetableTermFormSchemaEn.safeParse({
      name: args.name,
      kind: args.kind,
      startDateKey: args.startDateKey,
      endDateKey: args.endDateKey,
      days: args.days,
      startTime: args.startTime,
      endTime: args.endTime,
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const name = normalizeTermName(parsed.data.name);
    const dates = normalizeDateRange(parsed.data.startDateKey, parsed.data.endDateKey);
    const days = normalizeDays(parsed.data.days);
    const times = normalizeTimeRange(parsed.data.startTime, parsed.data.endTime);
    await ctx.db.patch("timetableTerms", args.termId, {
      name,
      kind: parsed.data.kind,
      startDateKey: dates.startDateKey,
      endDateKey: dates.endDateKey,
      days,
      startTime: times.startTime,
      endTime: times.endTime,
      updatedAt: Date.now(),
    });
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "timetableTerm",
      resourceId: args.termId,
      summary: `Updated timetable term "${name}"`,
      summaryKey: "activitySummary_updatedTimetableTerm",
      metadata: { name },
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
    const parsed = timetableSlotFormSchemaEn.safeParse({
      day: args.day,
      startTime: args.startTime,
      endTime: args.endTime,
      disabled: false,
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    if (!term.days.includes(parsed.data.day)) {
      throw new Error("Day is not in this term");
    }
    const times = normalizeSlotTimes(parsed.data.startTime, parsed.data.endTime);
    const now = Date.now();
    const slotId = await ctx.db.insert("timetableSlots", {
      classId: ctx.classDoc._id,
      termId: args.termId,
      day: parsed.data.day,
      startTime: times.startTime,
      endTime: times.endTime,
      disabled: false,
      createdAt: now,
      updatedAt: now,
    });
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "timetableSlot",
      resourceId: slotId,
      summary: `Created timetable slot ${times.startTime}–${times.endTime} on ${args.day}`,
      summaryKey: "activitySummary_createdTimetableSlot",
      metadata: { day: parsed.data.day, startTime: times.startTime, endTime: times.endTime },
    });
    return slotId;
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
    const parsed = timetableSlotFormSchemaEn.safeParse({
      day: args.day,
      startTime: args.startTime,
      endTime: args.endTime,
      disabled: args.disabled,
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    if (!term.days.includes(parsed.data.day)) {
      throw new Error("Day is not in this term");
    }
    const times = normalizeSlotTimes(parsed.data.startTime, parsed.data.endTime);
    await ctx.db.patch("timetableSlots", args.slotId, {
      day: parsed.data.day,
      startTime: times.startTime,
      endTime: times.endTime,
      disabled: parsed.data.disabled ?? false,
      updatedAt: Date.now(),
    });
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "timetableSlot",
      resourceId: args.slotId,
      summary: `Updated timetable slot ${times.startTime}–${times.endTime} on ${args.day}`,
      summaryKey: "activitySummary_updatedTimetableSlot",
      metadata: { day: parsed.data.day, startTime: times.startTime, endTime: times.endTime },
    });
    return null;
  },
});

export const removeSlot = classMutation({
  args: { slotId: v.id("timetableSlots") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("timetable:manage");
    const slot = await assertSlotBelongsToClass(ctx, ctx.classDoc._id, args.slotId);
    const slots = await listTermSlots(ctx, slot.termId);
    const slotIdsToClear = planRepairGroupAfterSlotDelete(
      args.slotId,
      slots as Array<SlotLinkLike>,
    );

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

    for (const slotIdToClear of slotIdsToClear) {
      await ctx.db.patch("timetableSlots", slotIdToClear, {
        linkGroupId: undefined,
        updatedAt: Date.now(),
      });
    }

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "timetableSlot",
      resourceId: args.slotId,
      summary: `Deleted timetable slot ${slot.startTime}–${slot.endTime} on ${slot.day}`,
      summaryKey: "activitySummary_deletedTimetableSlot",
      metadata: { day: slot.day, startTime: slot.startTime, endTime: slot.endTime },
    });
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
    const parsed = timetableSubjectFormSchemaEn.safeParse(args);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const name = normalizeSubjectName(parsed.data.name);
    const now = Date.now();
    const subjectId = await ctx.db.insert("timetableSubjects", {
      classId: ctx.classDoc._id,
      name,
      bgColor: normalizeHexColor(parsed.data.bgColor, "#6366f1"),
      textColor: normalizeHexColor(parsed.data.textColor, "#ffffff"),
      iconName: parsed.data.iconName?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "timetableSubject",
      resourceId: subjectId,
      summary: `Created timetable subject "${name}"`,
      summaryKey: "activitySummary_createdTimetableSubject",
      metadata: { name },
    });
    return subjectId;
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
    const parsed = timetableSubjectFormSchemaEn.safeParse({
      name: args.name,
      bgColor: args.bgColor,
      textColor: args.textColor,
      iconName: args.iconName,
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const name = normalizeSubjectName(parsed.data.name);
    await ctx.db.patch("timetableSubjects", args.subjectId, {
      name,
      bgColor: normalizeHexColor(parsed.data.bgColor, "#6366f1"),
      textColor: normalizeHexColor(parsed.data.textColor, "#ffffff"),
      iconName: parsed.data.iconName?.trim() || undefined,
      updatedAt: Date.now(),
    });
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "timetableSubject",
      resourceId: args.subjectId,
      summary: `Updated timetable subject "${name}"`,
      summaryKey: "activitySummary_updatedTimetableSubject",
      metadata: { name },
    });
    return null;
  },
});

export const removeSubject = classMutation({
  args: { subjectId: v.id("timetableSubjects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("timetable:manage");
    const subject = await assertSubjectBelongsToClass(ctx, ctx.classDoc._id, args.subjectId);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- subject-bounded cleanup
    const lessons = await ctx.db
      .query("timetableLessons")
      .withIndex("by_subjectId", (q) => q.eq("subjectId", args.subjectId))
      .collect();
    for (const lesson of lessons) {
      await ctx.db.delete("timetableLessons", lesson._id);
    }

    await ctx.db.delete("timetableSubjects", args.subjectId);
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "timetableSubject",
      resourceId: args.subjectId,
      summary: `Deleted timetable subject "${subject.name}"`,
      summaryKey: "activitySummary_deletedTimetableSubject",
      metadata: { name: subject.name },
    });
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
      await mirrorLessonChange(ctx, ctx.classDoc._id, args.termId, args.year, args.weekNumber, {
        type: "update",
        sourceLesson: {
          ...existing,
          notesJson: notesJson || undefined,
          complete: args.complete,
          links,
        },
      });
      return existing._id;
    }

    const lessonId = await ctx.db.insert("timetableLessons", {
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
    await mirrorLessonChange(ctx, ctx.classDoc._id, args.termId, args.year, args.weekNumber, {
      type: "add",
      sourceSlotId: args.slotId,
      subjectId: args.subjectId,
      notesJson: notesJson || undefined,
      complete: args.complete,
      links,
    });
    return lessonId;
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
    const lessonId = await ctx.db.insert("timetableLessons", {
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
    await mirrorLessonChange(ctx, ctx.classDoc._id, args.termId, args.year, args.weekNumber, {
      type: "add",
      sourceSlotId: args.slotId,
      subjectId: args.subjectId,
      complete: false,
      links: [],
    });
    return lessonId;
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
    await mirrorLessonChange(ctx, ctx.classDoc._id, lesson.termId, lesson.year, lesson.weekNumber, {
      type: "delete",
      sourceLesson: lesson,
    });
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

export const syncSlotLinks = classMutation({
  args: {
    termId: v.id("timetableTerms"),
    sourceSlotId: v.id("timetableSlots"),
    selectedSlotIds: v.array(v.id("timetableSlots")),
    year: v.number(),
    weekNumber: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("timetable:manage");
    await assertTermBelongsToClass(ctx, ctx.classDoc._id, args.termId);
    const sourceSlot = await assertSlotBelongsToClass(ctx, ctx.classDoc._id, args.sourceSlotId);
    if (sourceSlot.termId !== args.termId) {
      throw new Error("Slot does not belong to this term");
    }

    for (const slotId of args.selectedSlotIds) {
      const slot = await assertSlotBelongsToClass(ctx, ctx.classDoc._id, slotId);
      if (slot.termId !== args.termId) {
        throw new Error("All slots must belong to this term");
      }
    }

    const slots = await listTermSlots(ctx, args.termId);
    const lessons = await listWeekLessonsForTerm(ctx, args.termId, args.year, args.weekNumber);
    const { slotIdsToClear, linkPlan } = planSyncSlotLinkMembership({
      sourceSlotId: args.sourceSlotId,
      selectedSlotIds: args.selectedSlotIds,
      slots: slots as Array<SlotLinkLike>,
      lessons: lessons as Array<LessonLinkLike>,
      year: args.year,
      weekNumber: args.weekNumber,
    });

    const now = Date.now();
    for (const slotId of slotIdsToClear) {
      await ctx.db.patch("timetableSlots", slotId, {
        linkGroupId: undefined,
        updatedAt: now,
      });
    }

    if (!linkPlan) {
      await recordClassActivity(ctx, {
        classId: ctx.classDoc._id,
        actorUserId: ctx.userId,
        action: "update",
        resourceType: "timetableSlot",
        resourceId: args.sourceSlotId,
        summary: `Unlinked timetable slot on ${sourceSlot.day}`,
        summaryKey: "activitySummary_unlinkedTimetableSlot",
        metadata: { day: sourceSlot.day },
      });
      return null;
    }

    for (const slotId of linkPlan.slotIdsToUpdate) {
      await ctx.db.patch("timetableSlots", slotId, {
        linkGroupId: linkPlan.linkGroupId,
        updatedAt: now,
      });
    }

    await applyMirrorLessonOps(
      ctx,
      ctx.classDoc._id,
      args.termId,
      args.year,
      args.weekNumber,
      linkPlan.syncOps,
    );

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "timetableSlot",
      resourceId: args.sourceSlotId,
      summary: `Linked timetable slots on ${sourceSlot.day}`,
      summaryKey: "activitySummary_linkedTimetableSlots",
      metadata: {
        day: sourceSlot.day,
        count: String(linkPlan.slotIdsToUpdate.length),
      },
    });
    return null;
  },
});

export const unlinkSlot = classMutation({
  args: {
    termId: v.id("timetableTerms"),
    slotId: v.id("timetableSlots"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("timetable:manage");
    await assertTermBelongsToClass(ctx, ctx.classDoc._id, args.termId);
    const slot = await assertSlotBelongsToClass(ctx, ctx.classDoc._id, args.slotId);
    if (slot.termId !== args.termId) {
      throw new Error("Slot does not belong to this term");
    }

    const slots = await listTermSlots(ctx, args.termId);
    const { slotIdsToClear } = planUnlinkSlot({
      slotId: args.slotId,
      slots: slots as Array<SlotLinkLike>,
    });

    if (slotIdsToClear.length === 0) return null;

    const now = Date.now();
    for (const slotIdToClear of slotIdsToClear) {
      await ctx.db.patch("timetableSlots", slotIdToClear, {
        linkGroupId: undefined,
        updatedAt: now,
      });
    }

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "timetableSlot",
      resourceId: args.slotId,
      summary: `Unlinked timetable slot on ${slot.day}`,
      summaryKey: "activitySummary_unlinkedTimetableSlot",
      metadata: { day: slot.day },
    });
    return null;
  },
});
