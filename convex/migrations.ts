import { Migrations } from "@convex-dev/migrations";

import { components, internal } from "./_generated/api.js";
import type { DataModel } from "./_generated/dataModel.js";
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
