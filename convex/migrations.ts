import { Migrations } from "@convex-dev/migrations";

import { components, internal } from "./_generated/api.js";
import type { DataModel } from "./_generated/dataModel.js";
import { migrateTaskWorksheetImageFields } from "./lib/tasks/migrateWorksheetImage.js";
import { computeBackfillSortOrders } from "./lib/tasks/taskSortOrder.js";
import {
  migrateLessonSections,
  migrateSubjectSections,
  stripMissingAgendaReferences,
} from "./lib/timetable/sectionMigration.js";

export const migrations = new Migrations<DataModel>(components.migrations);

export const run = migrations.runner();

export const migrateTimetableLessonSections = migrations.define({
  table: "timetableLessons",
  migrateOne: (_ctx, doc) => migrateLessonSections(doc),
});

export const migrateTimetableSubjectSections = migrations.define({
  table: "timetableSubjects",
  migrateOne: (_ctx, doc) => migrateSubjectSections(doc),
});

export const runTimetableSectionMigrations = migrations.runner([
  internal.migrations.migrateTimetableLessonSections,
  internal.migrations.migrateTimetableSubjectSections,
]);

export const migrateOrphanedLessonAgendaRefs = migrations.define({
  table: "timetableLessons",
  migrateOne: async (ctx, doc) => {
    const agenda = await stripMissingAgendaReferences(ctx, doc.agenda);
    if (!agenda) return;
    return { agenda };
  },
});

export const migrateOrphanedSubjectAgendaRefs = migrations.define({
  table: "timetableSubjects",
  migrateOne: async (ctx, doc) => {
    const defaultAgenda = await stripMissingAgendaReferences(ctx, doc.defaultAgenda);
    if (!defaultAgenda) return;
    return { defaultAgenda };
  },
});

export const runOrphanedAgendaRefMigrations = migrations.runner([
  internal.migrations.migrateOrphanedLessonAgendaRefs,
  internal.migrations.migrateOrphanedSubjectAgendaRefs,
]);

export const migrateTaskWorksheetImagesToAttachments = migrations.define({
  table: "tasks",
  migrateOne: (_ctx, doc) => migrateTaskWorksheetImageFields(doc),
});

export const runTaskAttachmentMigrations = migrations.runner(
  internal.migrations.migrateTaskWorksheetImagesToAttachments,
);

export const migrateTaskSortOrders = migrations.define({
  table: "tasks",
  migrateOne: async (ctx, doc) => {
    if (doc.sortOrder !== undefined) return;
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- one-time class-scoped backfill
    const siblings = await ctx.db
      .query("tasks")
      .withIndex("by_classId", (q) => q.eq("classId", doc.classId))
      .collect();
    const assignmentNames = new Map<string, string>();
    for (const sibling of siblings) {
      if (!sibling.assignmentId || assignmentNames.has(sibling.assignmentId)) continue;
      const assignment = await ctx.db.get("assignments", sibling.assignmentId);
      if (assignment) assignmentNames.set(sibling.assignmentId, assignment.name);
    }
    const orders = computeBackfillSortOrders(
      siblings.map((sibling) => ({
        _id: sibling._id,
        name: sibling.name,
        updatedAt: sibling.updatedAt,
        ...(sibling.assignmentId
          ? {
              assignmentId: sibling.assignmentId,
              assignmentName: assignmentNames.get(sibling.assignmentId),
            }
          : {}),
      })),
    );
    const sortOrder = orders.get(doc._id);
    if (sortOrder === undefined) return;
    return { sortOrder };
  },
});

export const runTaskSortOrderMigrations = migrations.runner(
  internal.migrations.migrateTaskSortOrders,
);
