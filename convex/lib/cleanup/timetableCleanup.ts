import type { Id } from "../../_generated/dataModel.js";
import type { MutationCtx } from "../../_generated/server.js";
import {
  agendaItemsChanged,
  stripAgendaItemReferences,
  type AgendaItem,
} from "../timetable/sectionItems.js";

type AgendaRefs = {
  assignmentIds?: Iterable<Id<"assignments">>;
  taskIds?: Iterable<Id<"tasks">>;
};

function toRefSets(refs: AgendaRefs): {
  assignmentIds?: Set<string>;
  taskIds?: Set<string>;
} {
  return {
    ...(refs.assignmentIds ? { assignmentIds: new Set(refs.assignmentIds) } : {}),
    ...(refs.taskIds ? { taskIds: new Set(refs.taskIds) } : {}),
  };
}

async function patchAgendaIfChanged(
  ctx: MutationCtx,
  table: "timetableLessons" | "timetableSubjects",
  id: Id<"timetableLessons"> | Id<"timetableSubjects">,
  items: Array<AgendaItem> | undefined,
  refs: ReturnType<typeof toRefSets>,
): Promise<void> {
  if (!items) return;
  const next = stripAgendaItemReferences(items, refs);
  if (!agendaItemsChanged(items, next)) return;
  if (table === "timetableLessons") {
    await ctx.db.patch("timetableLessons", id as Id<"timetableLessons">, { agenda: next });
    return;
  }
  await ctx.db.patch("timetableSubjects", id as Id<"timetableSubjects">, { defaultAgenda: next });
}

/** Strip assignment/task ids from lesson agendas and subject default agendas. */
export async function stripAgendaResourceReferences(
  ctx: MutationCtx,
  classId: Id<"classes">,
  refs: AgendaRefs,
): Promise<void> {
  const sets = toRefSets(refs);
  if (!sets.assignmentIds && !sets.taskIds) return;

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class-bounded agenda cleanup
  const lessons = await ctx.db
    .query("timetableLessons")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const lesson of lessons) {
    await patchAgendaIfChanged(ctx, "timetableLessons", lesson._id, lesson.agenda, sets);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class-bounded agenda cleanup
  const subjects = await ctx.db
    .query("timetableSubjects")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const subject of subjects) {
    await patchAgendaIfChanged(ctx, "timetableSubjects", subject._id, subject.defaultAgenda, sets);
  }
}

export async function stripAgendaTaskReferences(
  ctx: MutationCtx,
  classId: Id<"classes">,
  taskId: Id<"tasks">,
): Promise<void> {
  await stripAgendaResourceReferences(ctx, classId, { taskIds: [taskId] });
}

export async function stripAgendaAssignmentReferences(
  ctx: MutationCtx,
  classId: Id<"classes">,
  assignmentId: Id<"assignments">,
): Promise<void> {
  await stripAgendaResourceReferences(ctx, classId, { assignmentIds: [assignmentId] });
}

/** Cascade-delete all timetable data for a class. */
export async function deleteTimetableForClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const slotDisables = await ctx.db
    .query("timetableSlotDisables")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const row of slotDisables) {
    await ctx.db.delete("timetableSlotDisables", row._id);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const lessons = await ctx.db
    .query("timetableLessons")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const lesson of lessons) {
    await ctx.db.delete("timetableLessons", lesson._id);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const slots = await ctx.db
    .query("timetableSlots")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const slot of slots) {
    await ctx.db.delete("timetableSlots", slot._id);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const subjects = await ctx.db
    .query("timetableSubjects")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const subject of subjects) {
    await ctx.db.delete("timetableSubjects", subject._id);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const tags = await ctx.db
    .query("timetableTags")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const tag of tags) {
    await ctx.db.delete("timetableTags", tag._id);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const terms = await ctx.db
    .query("timetableTerms")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const term of terms) {
    await ctx.db.delete("timetableTerms", term._id);
  }
}
