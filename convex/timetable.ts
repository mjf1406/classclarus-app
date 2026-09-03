import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel.js";
import type { MutationCtx } from "./_generated/server.js";
import { recordClassActivity } from "./lib/activity/classActivity.js";
import { classMutation, classQuery } from "./lib/auth/customFunctions.js";
import { isValidTimeZone } from "./lib/calendar/timeZone.js";
import {
  agendaItemValidator,
  calendarAudienceRoleValidator,
  collectItemTags,
  copySubjectDefaults,
  lessonSectionsEqual,
  MAX_TAG_DICTIONARY,
  normalizeAgendaItems,
  normalizeCalendarAudienceRoles,
  normalizeSectionItems,
  sectionItemValidator,
  upsertClassTags,
} from "./lib/timetable/sectionItems.js";
import {
  lessonDateKeyFromSlot,
  resolveUpcomingAnnouncementEventLimit,
  selectUpcomingLessonEvents,
  upcomingLessonEventValidator,
  type LessonEventSource,
} from "./lib/timetable/lessonEvents.js";
import {
  normalizeDateRange,
  normalizeDays,
  normalizeHexColor,
  lessonResourceValidator,
  normalizeLessonResources,
  normalizeOptionalLessonUrl,
  weekBundleVisibleLessonUrl,
  weekBundleVisibleResources,
  normalizeSlotTimes,
  normalizeSubjectName,
  normalizeTermName,
  normalizeTimeRange,
  termKindValidator,
} from "./lib/timetable/timetableSchema.js";
import {
  timetableLessonFormSchemaEn,
  timetableSlotFormSchemaEn,
  timetableSubjectFormSchemaEn,
  timetableTermFormSchemaEn,
} from "./lib/timetable/timetableFormSchema.js";
import {
  applySlotDisableChange,
  isSlotDisableScope,
  isWeekdayName,
  isoWeekKey,
  listIsoWeeksForWeekdayInRange,
  type IsoWeek,
  type SlotDisableScope,
} from "./lib/timetable/slotDisableScope.js";
import {
  buildLessonGroupMirrorOps,
  buildMirrorLessonOps,
  createLinkGroupId,
  dedupeMirrorOps,
  findPeerLessonForAutoLink,
  getLessonLinkGroupMembers,
  planRepairGroupAfterSlotDelete,
  planSyncSlotLinkMembership,
  planUnlinkLesson,
  planUnlinkSlot,
  type LessonLinkLike,
  type MirrorLessonOp,
  type SlotLinkLike,
} from "./lib/timetable/slotLinks.js";
import { planImportedSlots, planImportedSubjects } from "./lib/timetable/importFromClass.js";
import { rateLimiter } from "./lib/rateLimiter.js";
import { authz } from "./authz.js";
import { classScope } from "./lib/auth/authzModel.js";

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
  defaultMaterials: v.array(sectionItemValidator),
  defaultAnnouncements: v.array(sectionItemValidator),
  defaultAgenda: v.array(agendaItemValidator),
  calendarAudienceRoles: v.array(v.string()),
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
  complete: v.boolean(),
  materials: v.array(sectionItemValidator),
  announcements: v.array(sectionItemValidator),
  agenda: v.array(agendaItemValidator),
  lessonUrl: v.optional(v.string()),
  lessonUrlShared: v.boolean(),
  resources: v.array(lessonResourceValidator),
  resourcesShared: v.boolean(),
  lessonLinkGroupId: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  subject: subjectValidator,
  upcomingEvents: v.array(upcomingLessonEventValidator),
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

function toSubjectDto(subject: Doc<"timetableSubjects">) {
  return {
    _id: subject._id,
    _creationTime: subject._creationTime,
    classId: subject.classId,
    name: subject.name,
    bgColor: subject.bgColor,
    textColor: subject.textColor,
    iconName: subject.iconName,
    defaultMaterials: subject.defaultMaterials ?? [],
    defaultAnnouncements: subject.defaultAnnouncements ?? [],
    defaultAgenda: subject.defaultAgenda ?? [],
    calendarAudienceRoles: subject.calendarAudienceRoles ?? ["student"],
    createdAt: subject.createdAt,
    updatedAt: subject.updatedAt,
  };
}

function toLessonLinkLike(lesson: Doc<"timetableLessons">): LessonLinkLike {
  return {
    _id: lesson._id,
    slotId: lesson.slotId,
    subjectId: lesson.subjectId,
    year: lesson.year,
    weekNumber: lesson.weekNumber,
    complete: lesson.complete,
    materials: lesson.materials ?? [],
    announcements: lesson.announcements ?? [],
    agenda: lesson.agenda ?? [],
    lessonUrl: lesson.lessonUrl,
    lessonUrlShared: lesson.lessonUrlShared === true,
    resources: lesson.resources ?? [],
    resourcesShared: lesson.resourcesShared === true,
    lessonLinkGroupId: lesson.lessonLinkGroupId,
  };
}

function lessonSectionsFromDoc(lesson: Doc<"timetableLessons">) {
  return {
    materials: lesson.materials ?? [],
    announcements: lesson.announcements ?? [],
    agenda: lesson.agenda ?? [],
  };
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
        complete: op.complete,
        links: [],
        materials: op.materials,
        announcements: op.announcements,
        agenda: op.agenda,
        lessonUrl: op.lessonUrl,
        lessonUrlShared: op.lessonUrlShared === true,
        resources: op.resources ?? [],
        resourcesShared: op.resourcesShared === true,
        createdAt: now,
        updatedAt: now,
      });
      continue;
    }
    if (op.op === "updateLesson") {
      await ctx.db.patch("timetableLessons", op.lessonId, {
        complete: op.complete,
        links: [],
        materials: op.materials,
        announcements: op.announcements,
        agenda: op.agenda,
        lessonUrl: op.lessonUrl,
        lessonUrlShared: op.lessonUrlShared === true,
        resources: op.resources ?? [],
        resourcesShared: op.resourcesShared === true,
        notesJson: undefined,
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
  options?: { includeLessonGroup?: boolean; sourceLesson?: LessonLinkLike },
): Promise<void> {
  const slots = await listTermSlots(ctx, termId);
  const lessons = await listWeekLessonsForTerm(ctx, termId, year, weekNumber);
  const linkLikes = lessons.map(toLessonLinkLike);
  const slotOps = buildMirrorLessonOps(
    change,
    slots as Array<SlotLinkLike>,
    linkLikes,
    year,
    weekNumber,
  );
  const groupOps =
    options?.includeLessonGroup && options.sourceLesson
      ? buildLessonGroupMirrorOps(options.sourceLesson, linkLikes)
      : [];
  const memberSlotOps: Array<MirrorLessonOp> = [];
  if (options?.includeLessonGroup && options.sourceLesson) {
    for (const member of getLessonLinkGroupMembers(options.sourceLesson, linkLikes)) {
      memberSlotOps.push(
        ...buildMirrorLessonOps(
          {
            type: "update",
            sourceLesson: { ...member, ...sectionFieldsFromSource(options.sourceLesson) },
          },
          slots as Array<SlotLinkLike>,
          linkLikes,
          year,
          weekNumber,
        ),
      );
    }
  }
  await applyMirrorLessonOps(
    ctx,
    classId,
    termId,
    year,
    weekNumber,
    dedupeMirrorOps([...slotOps, ...groupOps, ...memberSlotOps]),
  );
}

function sectionFieldsFromSource(lesson: LessonLinkLike) {
  return {
    materials: lesson.materials,
    announcements: lesson.announcements,
    agenda: lesson.agenda,
    complete: lesson.complete,
    lessonUrl: lesson.lessonUrl,
    lessonUrlShared: lesson.lessonUrlShared,
    resources: lesson.resources,
    resourcesShared: lesson.resourcesShared,
  };
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
    const canManageTimetable = await ctx.can("timetable:manage");
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

    const subjectDtos = subjects.map(toSubjectDto);
    const subjectById = new Map(subjectDtos.map((s) => [s._id, s]));

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- week-bounded lessons
    const lessonRows = await ctx.db
      .query("timetableLessons")
      .withIndex("by_termId_year_week", (q) =>
        q.eq("termId", args.termId).eq("year", args.year).eq("weekNumber", args.weekNumber),
      )
      .collect();

    const timeZone =
      ctx.classDoc.timezone && isValidTimeZone(ctx.classDoc.timezone)
        ? ctx.classDoc.timezone
        : "UTC";
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded calendar list
    const calendarDocs = (await ctx.db
      .query("calendarEvents")
      .withIndex("by_classId", (q) => q.eq("classId", ctx.classDoc._id))
      .collect()) as Array<LessonEventSource>;

    const eventCache = new Map<string, ReturnType<typeof selectUpcomingLessonEvents>>();
    const slotById = new Map(slots.map((slot) => [slot._id, slot]));

    const lessons = lessonRows
      .map((lesson) => {
        const subject = subjectById.get(lesson.subjectId);
        if (!subject) return null;
        const slot = slotById.get(lesson.slotId);
        const dateKey = slot
          ? lessonDateKeyFromSlot(lesson.year, lesson.weekNumber, slot.day)
          : null;
        const cacheKey = `${dateKey ?? ""}|${subject.calendarAudienceRoles.join(",")}`;
        let upcomingEvents = eventCache.get(cacheKey);
        if (!upcomingEvents) {
          upcomingEvents = dateKey
            ? selectUpcomingLessonEvents(
                calendarDocs,
                dateKey,
                timeZone,
                subject.calendarAudienceRoles,
                resolveUpcomingAnnouncementEventLimit(ctx.classDoc.upcomingAnnouncementEventLimit),
              )
            : [];
          eventCache.set(cacheKey, upcomingEvents);
        }
        return {
          _id: lesson._id,
          _creationTime: lesson._creationTime,
          classId: lesson.classId,
          termId: lesson.termId,
          slotId: lesson.slotId,
          subjectId: lesson.subjectId,
          year: lesson.year,
          weekNumber: lesson.weekNumber,
          complete: lesson.complete,
          materials: lesson.materials ?? [],
          announcements: lesson.announcements ?? [],
          agenda: lesson.agenda ?? [],
          lessonUrl: weekBundleVisibleLessonUrl(lesson, canManageTimetable),
          lessonUrlShared: lesson.lessonUrlShared === true,
          resources: weekBundleVisibleResources(lesson, canManageTimetable),
          resourcesShared: lesson.resourcesShared === true,
          lessonLinkGroupId: lesson.lessonLinkGroupId,
          createdAt: lesson.createdAt,
          updatedAt: lesson.updatedAt,
          subject,
          upcomingEvents,
        };
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
      subjects: subjectDtos,
      lessons,
      disabledSlotIds,
    };
  },
});

export const listTags = classQuery({
  args: {},
  returns: v.array(
    v.object({
      tag: v.string(),
      display: v.string(),
    }),
  ),
  handler: async (ctx) => {
    await ctx.require("timetable:read");
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded tag dictionary
    const rows = await ctx.db
      .query("timetableTags")
      .withIndex("by_classId", (q) => q.eq("classId", ctx.classDoc._id))
      .collect();
    return rows
      .slice()
      .sort((a, b) => a.display.localeCompare(b.display))
      .slice(0, MAX_TAG_DICTIONARY)
      .map((row) => ({ tag: row.tag, display: row.display }));
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
    defaultMaterials: v.optional(v.array(sectionItemValidator)),
    defaultAnnouncements: v.optional(v.array(sectionItemValidator)),
    defaultAgenda: v.optional(v.array(agendaItemValidator)),
    calendarAudienceRoles: v.optional(v.array(calendarAudienceRoleValidator)),
  },
  returns: v.id("timetableSubjects"),
  handler: async (ctx, args) => {
    await ctx.require("timetable:manage");
    const parsed = timetableSubjectFormSchemaEn.safeParse({
      name: args.name,
      bgColor: args.bgColor,
      textColor: args.textColor,
      iconName: args.iconName,
      defaultMaterials: args.defaultMaterials ?? [],
      defaultAnnouncements: args.defaultAnnouncements ?? [],
      defaultAgenda: args.defaultAgenda ?? [],
      calendarAudienceRoles: args.calendarAudienceRoles ?? ["student"],
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const name = normalizeSubjectName(parsed.data.name);
    const defaultMaterials = normalizeSectionItems(parsed.data.defaultMaterials);
    const defaultAnnouncements = normalizeSectionItems(parsed.data.defaultAnnouncements);
    const defaultAgenda = await normalizeAgendaItems(
      ctx,
      ctx.classDoc._id,
      parsed.data.defaultAgenda,
    );
    const calendarAudienceRoles = normalizeCalendarAudienceRoles(parsed.data.calendarAudienceRoles);
    await upsertClassTags(ctx, ctx.classDoc._id, [
      ...collectItemTags(defaultMaterials),
      ...collectItemTags(defaultAnnouncements),
      ...collectItemTags(defaultAgenda),
    ]);
    const now = Date.now();
    const subjectId = await ctx.db.insert("timetableSubjects", {
      classId: ctx.classDoc._id,
      name,
      bgColor: normalizeHexColor(parsed.data.bgColor, "#6366f1"),
      textColor: normalizeHexColor(parsed.data.textColor, "#ffffff"),
      iconName: parsed.data.iconName?.trim() || undefined,
      defaultMaterials,
      defaultAnnouncements,
      defaultAgenda,
      calendarAudienceRoles,
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
    defaultMaterials: v.optional(v.array(sectionItemValidator)),
    defaultAnnouncements: v.optional(v.array(sectionItemValidator)),
    defaultAgenda: v.optional(v.array(agendaItemValidator)),
    calendarAudienceRoles: v.optional(v.array(calendarAudienceRoleValidator)),
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
      defaultMaterials: args.defaultMaterials ?? [],
      defaultAnnouncements: args.defaultAnnouncements ?? [],
      defaultAgenda: args.defaultAgenda ?? [],
      calendarAudienceRoles: args.calendarAudienceRoles ?? ["student"],
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const name = normalizeSubjectName(parsed.data.name);
    const defaultMaterials = normalizeSectionItems(parsed.data.defaultMaterials);
    const defaultAnnouncements = normalizeSectionItems(parsed.data.defaultAnnouncements);
    const defaultAgenda = await normalizeAgendaItems(
      ctx,
      ctx.classDoc._id,
      parsed.data.defaultAgenda,
    );
    const calendarAudienceRoles = normalizeCalendarAudienceRoles(parsed.data.calendarAudienceRoles);
    await upsertClassTags(ctx, ctx.classDoc._id, [
      ...collectItemTags(defaultMaterials),
      ...collectItemTags(defaultAnnouncements),
      ...collectItemTags(defaultAgenda),
    ]);
    await ctx.db.patch("timetableSubjects", args.subjectId, {
      name,
      bgColor: normalizeHexColor(parsed.data.bgColor, "#6366f1"),
      textColor: normalizeHexColor(parsed.data.textColor, "#ffffff"),
      iconName: parsed.data.iconName?.trim() || undefined,
      defaultMaterials,
      defaultAnnouncements,
      defaultAgenda,
      calendarAudienceRoles,
      defaultNotesJson: undefined,
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
    complete: v.boolean(),
    materials: v.array(sectionItemValidator),
    announcements: v.array(sectionItemValidator),
    agenda: v.array(agendaItemValidator),
    lessonUrl: v.optional(v.string()),
    lessonUrlShared: v.optional(v.boolean()),
    resources: v.optional(v.array(lessonResourceValidator)),
    resourcesShared: v.optional(v.boolean()),
  },
  returns: v.id("timetableLessons"),
  handler: async (ctx, args) => {
    await ctx.require("timetable:manage");
    await assertTermBelongsToClass(ctx, ctx.classDoc._id, args.termId);
    const slot = await assertSlotBelongsToClass(ctx, ctx.classDoc._id, args.slotId);
    if (slot.termId !== args.termId) throw new Error("Slot does not belong to this term");
    const subject = await assertSubjectBelongsToClass(ctx, ctx.classDoc._id, args.subjectId);

    const parsed = timetableLessonFormSchemaEn.safeParse({
      complete: args.complete,
      lessonUrl: args.lessonUrl ?? "",
      lessonUrlShared: args.lessonUrlShared === true,
      resources: args.resources ?? [],
      resourcesShared: args.resourcesShared === true,
      materials: args.materials,
      announcements: args.announcements,
      agenda: args.agenda,
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const materials = normalizeSectionItems(parsed.data.materials);
    const announcements = normalizeSectionItems(parsed.data.announcements);
    const agenda = await normalizeAgendaItems(ctx, ctx.classDoc._id, parsed.data.agenda);
    const lessonUrl = normalizeOptionalLessonUrl(parsed.data.lessonUrl);
    const lessonUrlShared = parsed.data.lessonUrlShared;
    const resources = normalizeLessonResources(parsed.data.resources);
    const resourcesShared = parsed.data.resourcesShared;
    await upsertClassTags(ctx, ctx.classDoc._id, [
      ...collectItemTags(materials),
      ...collectItemTags(announcements),
      ...collectItemTags(agenda),
    ]);
    const now = Date.now();
    const sections = {
      materials,
      announcements,
      agenda,
      lessonUrl,
      lessonUrlShared,
      resources,
      resourcesShared,
    };

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- slot-week lessons are few
    const existingRows = await ctx.db
      .query("timetableLessons")
      .withIndex("by_slotId_year_week", (q) =>
        q.eq("slotId", args.slotId).eq("year", args.year).eq("weekNumber", args.weekNumber),
      )
      .collect();
    const existing = existingRows.find((row) => row.subjectId === args.subjectId);

    if (existing) {
      const contentChanged =
        !lessonSectionsEqual(lessonSectionsFromDoc(existing), sections) ||
        (existing.lessonUrl ?? undefined) !== (lessonUrl ?? undefined) ||
        (existing.lessonUrlShared === true) !== lessonUrlShared ||
        JSON.stringify(existing.resources ?? []) !== JSON.stringify(resources) ||
        (existing.resourcesShared === true) !== resourcesShared;
      await ctx.db.patch("timetableLessons", existing._id, {
        complete: args.complete,
        links: [],
        notesJson: undefined,
        ...sections,
        updatedAt: now,
      });
      const sourceLesson = {
        ...toLessonLinkLike(existing),
        ...sections,
        complete: args.complete,
      };
      await mirrorLessonChange(
        ctx,
        ctx.classDoc._id,
        args.termId,
        args.year,
        args.weekNumber,
        {
          type: "update",
          sourceLesson,
        },
        { includeLessonGroup: true, sourceLesson },
      );
      if (contentChanged) {
        await recordClassActivity(ctx, {
          classId: ctx.classDoc._id,
          actorUserId: ctx.userId,
          action: "update",
          resourceType: "timetableLesson",
          resourceId: existing._id,
          summary: `Updated timetable lesson for "${subject.name}"`,
          summaryKey: "activitySummary_updatedTimetableLesson",
          metadata: { name: subject.name },
        });
      }
      return existing._id;
    }

    const lessonId = await ctx.db.insert("timetableLessons", {
      classId: ctx.classDoc._id,
      termId: args.termId,
      slotId: args.slotId,
      subjectId: args.subjectId,
      year: args.year,
      weekNumber: args.weekNumber,
      complete: args.complete,
      links: [],
      ...sections,
      createdAt: now,
      updatedAt: now,
    });
    await mirrorLessonChange(ctx, ctx.classDoc._id, args.termId, args.year, args.weekNumber, {
      type: "add",
      sourceSlotId: args.slotId,
      subjectId: args.subjectId,
      complete: args.complete,
      ...sections,
    });
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "timetableLesson",
      resourceId: lessonId,
      summary: `Added timetable lesson for "${subject.name}"`,
      summaryKey: "activitySummary_addedTimetableLesson",
      metadata: { name: subject.name },
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
    const subject = await assertSubjectBelongsToClass(ctx, ctx.classDoc._id, args.subjectId);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- slot-week lessons are few
    const existingRows = await ctx.db
      .query("timetableLessons")
      .withIndex("by_slotId_year_week", (q) =>
        q.eq("slotId", args.slotId).eq("year", args.year).eq("weekNumber", args.weekNumber),
      )
      .collect();
    const existing = existingRows.find((row) => row.subjectId === args.subjectId);
    if (existing) return existing._id;

    const weekLessons = await listWeekLessonsForTerm(ctx, args.termId, args.year, args.weekNumber);
    const termSlots = await listTermSlots(ctx, args.termId);
    const peer = findPeerLessonForAutoLink(
      args.slotId,
      args.subjectId,
      args.year,
      args.weekNumber,
      termSlots as Array<SlotLinkLike>,
      weekLessons.map(toLessonLinkLike),
    );
    const now = Date.now();
    let sections = {
      ...copySubjectDefaults(subject),
      lessonUrl: undefined as string | undefined,
      lessonUrlShared: false,
      resources: [] as NonNullable<Doc<"timetableLessons">["resources"]>,
      resourcesShared: false,
    };
    let lessonLinkGroupId: string | undefined;
    if (peer) {
      sections = {
        materials: peer.materials,
        announcements: peer.announcements,
        agenda: peer.agenda,
        lessonUrl: peer.lessonUrl,
        lessonUrlShared: peer.lessonUrlShared === true,
        resources: peer.resources ?? [],
        resourcesShared: peer.resourcesShared === true,
      };
      lessonLinkGroupId = peer.lessonLinkGroupId ?? createLinkGroupId();
      if (!peer.lessonLinkGroupId) {
        await ctx.db.patch("timetableLessons", peer._id, {
          lessonLinkGroupId,
          updatedAt: now,
        });
      }
    }
    const lessonId = await ctx.db.insert("timetableLessons", {
      classId: ctx.classDoc._id,
      termId: args.termId,
      slotId: args.slotId,
      subjectId: args.subjectId,
      year: args.year,
      weekNumber: args.weekNumber,
      complete: peer?.complete === true,
      links: [],
      ...sections,
      ...(lessonLinkGroupId ? { lessonLinkGroupId } : {}),
      createdAt: now,
      updatedAt: now,
    });
    await mirrorLessonChange(ctx, ctx.classDoc._id, args.termId, args.year, args.weekNumber, {
      type: "add",
      sourceSlotId: args.slotId,
      subjectId: args.subjectId,
      complete: peer?.complete === true,
      ...sections,
    });
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "timetableLesson",
      resourceId: lessonId,
      summary: `Added timetable lesson for "${subject.name}"`,
      summaryKey: "activitySummary_addedTimetableLesson",
      metadata: { name: subject.name },
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
      sourceLesson: toLessonLinkLike(lesson),
    });
    const weekLessons = await listWeekLessonsForTerm(
      ctx,
      lesson.termId,
      lesson.year,
      lesson.weekNumber,
    );
    const { lessonIdsToClear } = planUnlinkLesson(args.lessonId, weekLessons.map(toLessonLinkLike));
    await ctx.db.delete("timetableLessons", args.lessonId);
    const leftoverIds = lessonIdsToClear.filter((id) => id !== args.lessonId);
    for (const leftoverId of leftoverIds) {
      await ctx.db.patch("timetableLessons", leftoverId, {
        lessonLinkGroupId: undefined,
        updatedAt: Date.now(),
      });
    }
    const subject = await ctx.db.get("timetableSubjects", lesson.subjectId);
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "timetableLesson",
      resourceId: args.lessonId,
      summary: `Removed timetable lesson for "${subject?.name ?? "subject"}"`,
      summaryKey: "activitySummary_deletedTimetableLesson",
      metadata: { name: subject?.name ?? "subject" },
    });
    return null;
  },
});

export const moveLesson = classMutation({
  args: {
    lessonId: v.id("timetableLessons"),
    targetSlotId: v.id("timetableSlots"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("timetable:manage");
    const lesson = await ctx.db.get("timetableLessons", args.lessonId);
    if (!lesson || lesson.classId !== ctx.classDoc._id) {
      throw new ConvexError({ message: "Lesson not found" });
    }
    if (lesson.slotId === args.targetSlotId) {
      return null;
    }
    const sourceSlot = await assertSlotBelongsToClass(ctx, ctx.classDoc._id, lesson.slotId);
    const targetSlot = await assertSlotBelongsToClass(ctx, ctx.classDoc._id, args.targetSlotId);
    if (targetSlot.termId !== lesson.termId || sourceSlot.termId !== lesson.termId) {
      throw new Error("Slot does not belong to this term");
    }

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- slot-week lessons are few
    const targetRows = await ctx.db
      .query("timetableLessons")
      .withIndex("by_slotId_year_week", (q) =>
        q
          .eq("slotId", args.targetSlotId)
          .eq("year", lesson.year)
          .eq("weekNumber", lesson.weekNumber),
      )
      .collect();
    if (targetRows.some((row) => row.subjectId === lesson.subjectId)) {
      throw new Error("That slot already has this subject");
    }

    const sections = {
      materials: lesson.materials ?? [],
      announcements: lesson.announcements ?? [],
      agenda: lesson.agenda ?? [],
      complete: lesson.complete,
      lessonUrl: lesson.lessonUrl,
      lessonUrlShared: lesson.lessonUrlShared === true,
      resources: lesson.resources ?? [],
      resourcesShared: lesson.resourcesShared === true,
    };

    await mirrorLessonChange(ctx, ctx.classDoc._id, lesson.termId, lesson.year, lesson.weekNumber, {
      type: "delete",
      sourceLesson: toLessonLinkLike(lesson),
    });
    await ctx.db.patch("timetableLessons", args.lessonId, {
      slotId: args.targetSlotId,
      updatedAt: Date.now(),
    });
    await mirrorLessonChange(ctx, ctx.classDoc._id, lesson.termId, lesson.year, lesson.weekNumber, {
      type: "add",
      sourceSlotId: args.targetSlotId,
      subjectId: lesson.subjectId,
      ...sections,
    });

    const subject = await ctx.db.get("timetableSubjects", lesson.subjectId);
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "timetableLesson",
      resourceId: args.lessonId,
      summary: `Moved timetable lesson for "${subject?.name ?? "subject"}"`,
      summaryKey: "activitySummary_movedTimetableLesson",
      metadata: { name: subject?.name ?? "subject" },
    });
    return null;
  },
});

export const unlinkLesson = classMutation({
  args: { lessonId: v.id("timetableLessons") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("timetable:manage");
    const lesson = await ctx.db.get("timetableLessons", args.lessonId);
    if (!lesson || lesson.classId !== ctx.classDoc._id) {
      throw new ConvexError({ message: "Lesson not found" });
    }
    if (!lesson.lessonLinkGroupId) {
      return null;
    }
    const weekLessons = await listWeekLessonsForTerm(
      ctx,
      lesson.termId,
      lesson.year,
      lesson.weekNumber,
    );
    const { lessonIdsToClear } = planUnlinkLesson(args.lessonId, weekLessons.map(toLessonLinkLike));
    const now = Date.now();
    for (const lessonId of lessonIdsToClear) {
      await ctx.db.patch("timetableLessons", lessonId, {
        lessonLinkGroupId: undefined,
        updatedAt: now,
      });
    }
    const subject = await ctx.db.get("timetableSubjects", lesson.subjectId);
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "timetableLesson",
      resourceId: args.lessonId,
      summary: `Unlinked timetable lesson for "${subject?.name ?? "subject"}"`,
      summaryKey: "activitySummary_unlinkedTimetableLesson",
      metadata: { name: subject?.name ?? "subject" },
    });
    return null;
  },
});

const DISABLE_SCOPE_SUMMARY: Record<SlotDisableScope, string> = {
  thisWeek: "this week",
  fromWeek: "this week and future weeks",
  allWeeks: "all weeks",
};

async function listSlotDisableRows(
  ctx: MutationCtx,
  slotId: Id<"timetableSlots">,
): Promise<Array<Doc<"timetableSlotDisables">>> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- slot-bounded disable rows
  return await ctx.db
    .query("timetableSlotDisables")
    .withIndex("by_slotId_year_week", (q) => q.eq("slotId", slotId))
    .collect();
}

async function writeSlotDisableState(
  ctx: MutationCtx,
  classId: Id<"classes">,
  slot: Doc<"timetableSlots">,
  next: { globallyDisabled: boolean; disabledWeeks: Array<IsoWeek> },
): Promise<void> {
  const now = Date.now();
  if (slot.disabled !== next.globallyDisabled) {
    await ctx.db.patch("timetableSlots", slot._id, {
      disabled: next.globallyDisabled,
      updatedAt: now,
    });
  }

  const existingRows = await listSlotDisableRows(ctx, slot._id);
  const nextKeys = new Set(next.disabledWeeks.map(isoWeekKey));
  const existingByKey = new Map(
    existingRows.map((row) => [isoWeekKey({ year: row.year, weekNumber: row.weekNumber }), row]),
  );

  for (const [key, row] of existingByKey) {
    if (!nextKeys.has(key)) {
      await ctx.db.delete("timetableSlotDisables", row._id);
    }
  }

  for (const week of next.disabledWeeks) {
    if (existingByKey.has(isoWeekKey(week))) continue;
    await ctx.db.insert("timetableSlotDisables", {
      classId,
      slotId: slot._id,
      year: week.year,
      weekNumber: week.weekNumber,
      createdAt: now,
    });
  }
}

export const setSlotsDisabled = classMutation({
  args: {
    termId: v.id("timetableTerms"),
    year: v.number(),
    weekNumber: v.number(),
    disabled: v.boolean(),
    scope: v.union(v.literal("thisWeek"), v.literal("fromWeek"), v.literal("allWeeks")),
    slotId: v.optional(v.id("timetableSlots")),
    day: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("timetable:manage");
    const term = await assertTermBelongsToClass(ctx, ctx.classDoc._id, args.termId);
    if (!isSlotDisableScope(args.scope)) {
      throw new Error("Invalid disable range");
    }
    if ((args.slotId && args.day) || (!args.slotId && !args.day)) {
      throw new Error("Choose a slot or a day");
    }
    if (args.weekNumber < 1 || args.weekNumber > 53) {
      throw new Error("Invalid week");
    }

    const slots = await listTermSlots(ctx, args.termId);
    const selected: IsoWeek = { year: args.year, weekNumber: args.weekNumber };
    let targetSlots: Array<Doc<"timetableSlots">>;
    let dayName: string;

    if (args.slotId) {
      const slot = await assertSlotBelongsToClass(ctx, ctx.classDoc._id, args.slotId);
      if (slot.termId !== args.termId) {
        throw new Error("Slot does not belong to this term");
      }
      targetSlots = [slot];
      dayName = slot.day;
    } else {
      if (!args.day || !isWeekdayName(args.day) || !term.days.includes(args.day)) {
        throw new Error("Day is not in this term");
      }
      dayName = args.day;
      targetSlots = slots.filter((slot) => slot.day === args.day);
    }

    if (targetSlots.length === 0) {
      return null;
    }

    for (const slot of targetSlots) {
      if (!isWeekdayName(slot.day)) continue;
      const termWeeks = listIsoWeeksForWeekdayInRange(term.startDateKey, term.endDateKey, slot.day);
      const existingRows = await listSlotDisableRows(ctx, slot._id);
      const next = applySlotDisableChange(
        {
          globallyDisabled: slot.disabled,
          disabledWeeks: existingRows.map((row) => ({
            year: row.year,
            weekNumber: row.weekNumber,
          })),
        },
        termWeeks,
        selected,
        args.scope,
        args.disabled,
      );
      await writeSlotDisableState(ctx, ctx.classDoc._id, slot, next);
    }

    const scopeLabel = DISABLE_SCOPE_SUMMARY[args.scope];
    const firstSlot = targetSlots[0]!;
    if (args.day) {
      await recordClassActivity(ctx, {
        classId: ctx.classDoc._id,
        actorUserId: ctx.userId,
        action: "update",
        resourceType: "timetableSlot",
        resourceId: firstSlot._id,
        summary: args.disabled
          ? `Disabled timetable slots on ${dayName} (${scopeLabel})`
          : `Enabled timetable slots on ${dayName} (${scopeLabel})`,
        summaryKey: args.disabled
          ? "activitySummary_disabledTimetableDay"
          : "activitySummary_enabledTimetableDay",
        metadata: { day: dayName, scope: args.scope },
      });
    } else {
      await recordClassActivity(ctx, {
        classId: ctx.classDoc._id,
        actorUserId: ctx.userId,
        action: "update",
        resourceType: "timetableSlot",
        resourceId: firstSlot._id,
        summary: args.disabled
          ? `Disabled timetable slot ${firstSlot.startTime}–${firstSlot.endTime} on ${dayName} (${scopeLabel})`
          : `Enabled timetable slot ${firstSlot.startTime}–${firstSlot.endTime} on ${dayName} (${scopeLabel})`,
        summaryKey: args.disabled
          ? "activitySummary_disabledTimetableSlot"
          : "activitySummary_enabledTimetableSlot",
        metadata: {
          day: dayName,
          startTime: firstSlot.startTime,
          endTime: firstSlot.endTime,
          scope: args.scope,
        },
      });
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
      lessons: lessons.map(toLessonLinkLike),
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

export const importFromClass = classMutation({
  args: {
    sourceClassId: v.id("classes"),
    targetTermId: v.id("timetableTerms"),
    sourceTermId: v.optional(v.id("timetableTerms")),
    importSubjects: v.boolean(),
    importSlots: v.boolean(),
  },
  returns: v.object({
    subjectCount: v.number(),
    slotCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "timetableImport", { key: ctx.userId, throws: true });
    await ctx.require("timetable:manage");

    const targetClassId = ctx.classDoc._id;
    if (args.sourceClassId === targetClassId) {
      throw new Error("Choose a different class to import from");
    }
    if (!args.importSubjects && !args.importSlots) {
      throw new Error("Choose subjects, slots, or both");
    }
    if (args.importSlots && !args.sourceTermId) {
      throw new Error("Select a term to copy slots from");
    }

    const targetTerm = await assertTermBelongsToClass(ctx, targetClassId, args.targetTermId);

    const sourceClass = await ctx.db.get("classes", args.sourceClassId);
    if (!sourceClass || sourceClass.archivedAt !== undefined) {
      throw new ConvexError({
        code: "CLASS_UNAVAILABLE",
        message: "Class not found or access denied",
      });
    }

    const canManageSource = await authz.can(
      ctx,
      ctx.userId,
      "timetable:manage",
      classScope(args.sourceClassId),
    );
    if (!canManageSource) {
      throw new ConvexError({
        code: "CLASS_UNAVAILABLE",
        message: "Class not found or access denied",
      });
    }

    const now = Date.now();
    let subjectCount = 0;
    let slotCount = 0;

    if (args.importSubjects) {
      // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded import source
      const sourceSubjects = await ctx.db
        .query("timetableSubjects")
        .withIndex("by_classId", (q) => q.eq("classId", args.sourceClassId))
        .collect();
      // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded import target
      const existingSubjects = await ctx.db
        .query("timetableSubjects")
        .withIndex("by_classId", (q) => q.eq("classId", targetClassId))
        .collect();
      const planned = planImportedSubjects(
        sourceSubjects.map((subject) => ({
          name: subject.name,
          bgColor: subject.bgColor,
          textColor: subject.textColor,
          iconName: subject.iconName,
          defaultMaterials: subject.defaultMaterials,
          defaultAnnouncements: subject.defaultAnnouncements,
          defaultAgenda: subject.defaultAgenda,
          calendarAudienceRoles: subject.calendarAudienceRoles,
        })),
        existingSubjects.map((subject) => subject.name),
      );
      for (const subject of planned) {
        const defaultMaterials = normalizeSectionItems(subject.defaultMaterials);
        const defaultAnnouncements = normalizeSectionItems(subject.defaultAnnouncements);
        const defaultAgenda = await normalizeAgendaItems(ctx, targetClassId, subject.defaultAgenda);
        const calendarAudienceRoles = normalizeCalendarAudienceRoles(subject.calendarAudienceRoles);
        await ctx.db.insert("timetableSubjects", {
          classId: targetClassId,
          name: normalizeSubjectName(subject.name),
          bgColor: normalizeHexColor(subject.bgColor, "#6366f1"),
          textColor: normalizeHexColor(subject.textColor, "#ffffff"),
          iconName: subject.iconName?.trim() || undefined,
          defaultMaterials,
          defaultAnnouncements,
          defaultAgenda,
          calendarAudienceRoles,
          createdAt: now,
          updatedAt: now,
        });
        subjectCount += 1;
      }
    }

    if (args.importSlots && args.sourceTermId) {
      const sourceTerm = await ctx.db.get("timetableTerms", args.sourceTermId);
      if (!sourceTerm || sourceTerm.classId !== args.sourceClassId) {
        throw new ConvexError({ message: "Term not found" });
      }
      // eslint-disable-next-line @convex-dev/no-collect-in-query -- term-bounded import source
      const sourceSlots = await ctx.db
        .query("timetableSlots")
        .withIndex("by_termId", (q) => q.eq("termId", sourceTerm._id))
        .collect();
      // eslint-disable-next-line @convex-dev/no-collect-in-query -- term-bounded import target
      const existingSlots = await ctx.db
        .query("timetableSlots")
        .withIndex("by_termId", (q) => q.eq("termId", targetTerm._id))
        .collect();
      const planned = planImportedSlots(
        sourceSlots.map((slot) => ({
          day: slot.day,
          startTime: slot.startTime,
          endTime: slot.endTime,
          disabled: slot.disabled,
          linkGroupId: slot.linkGroupId,
        })),
        existingSlots,
        new Set(targetTerm.days),
      );
      for (const slot of planned) {
        await ctx.db.insert("timetableSlots", {
          classId: targetClassId,
          termId: targetTerm._id,
          day: slot.day,
          startTime: slot.startTime,
          endTime: slot.endTime,
          disabled: slot.disabled,
          ...(slot.linkGroupId ? { linkGroupId: slot.linkGroupId } : {}),
          createdAt: now,
          updatedAt: now,
        });
        slotCount += 1;
      }
    }

    await recordClassActivity(ctx, {
      classId: targetClassId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "timetableTerm",
      resourceId: targetTerm._id,
      summary: `Imported timetable from "${sourceClass.name}"`,
      summaryKey: "activitySummary_importedTimetable",
      metadata: {
        name: sourceClass.name,
        subjectCount: String(subjectCount),
        slotCount: String(slotCount),
        count: String(subjectCount + slotCount),
      },
    });

    return { subjectCount, slotCount };
  },
});
