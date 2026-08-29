import {
  DEFAULT_CALENDAR_AUDIENCE_ROLES,
  agendaItemsChanged,
  migrateLegacyLinks,
  stripAgendaItemReferences,
  type AgendaItem,
} from "./sectionItems.js";
import type { LessonLinkInput } from "./timetableSchema.js";
import type { Id } from "../../_generated/dataModel.js";

export type LegacyLessonDoc = {
  materials?: Array<{ key: string; text: string; tags: Array<string> }>;
  announcements?: Array<{ key: string; text: string; tags: Array<string> }>;
  agenda?: Array<{
    key: string;
    text: string;
    tags: Array<string>;
    assignmentId?: LessonLinkInput["assignmentId"];
    taskId?: LessonLinkInput["taskId"];
  }>;
  links?: Array<LessonLinkInput>;
  notesJson?: string;
};

export type LegacySubjectDoc = {
  defaultMaterials?: Array<{ key: string; text: string; tags: Array<string> }>;
  defaultAnnouncements?: Array<{ key: string; text: string; tags: Array<string> }>;
  defaultAgenda?: Array<{
    key: string;
    text: string;
    tags: Array<string>;
    assignmentId?: LessonLinkInput["assignmentId"];
    taskId?: LessonLinkInput["taskId"];
  }>;
  calendarAudienceRoles?: Array<string>;
  defaultNotesJson?: string;
};

export function migrateLessonSections(doc: LegacyLessonDoc) {
  const alreadyMigrated =
    doc.materials !== undefined || doc.announcements !== undefined || doc.agenda !== undefined;
  if (alreadyMigrated) {
    return {
      notesJson: undefined,
      links: [] as Array<LessonLinkInput>,
      materials: doc.materials ?? [],
      announcements: doc.announcements ?? [],
      agenda: doc.agenda ?? [],
    };
  }
  const migrated = migrateLegacyLinks(doc.links);
  return {
    notesJson: undefined,
    links: [] as Array<LessonLinkInput>,
    materials: migrated.materials,
    announcements: [],
    agenda: migrated.agenda,
  };
}

export function migrateSubjectSections(doc: LegacySubjectDoc) {
  const alreadyMigrated =
    doc.defaultMaterials !== undefined ||
    doc.defaultAnnouncements !== undefined ||
    doc.defaultAgenda !== undefined ||
    doc.calendarAudienceRoles !== undefined;
  if (alreadyMigrated) {
    return {
      defaultNotesJson: undefined,
      defaultMaterials: doc.defaultMaterials ?? [],
      defaultAnnouncements: doc.defaultAnnouncements ?? [],
      defaultAgenda: doc.defaultAgenda ?? [],
      calendarAudienceRoles: doc.calendarAudienceRoles ?? [...DEFAULT_CALENDAR_AUDIENCE_ROLES],
    };
  }
  return {
    defaultNotesJson: undefined,
    defaultMaterials: [],
    defaultAnnouncements: [],
    defaultAgenda: [],
    calendarAudienceRoles: [...DEFAULT_CALENDAR_AUDIENCE_ROLES],
  };
}

type AgendaLookupCtx = {
  db: {
    get: (
      table: "assignments" | "tasks",
      id: Id<"assignments"> | Id<"tasks">,
    ) => Promise<{ _id: string } | null>;
  };
};

/** Drop assignment/task ids whose documents no longer exist. */
export async function stripMissingAgendaReferences(
  ctx: AgendaLookupCtx,
  items: ReadonlyArray<AgendaItem> | undefined,
): Promise<Array<AgendaItem> | undefined> {
  if (!items || items.length === 0) return undefined;
  const assignmentIds = new Set<string>();
  const taskIds = new Set<string>();
  for (const item of items) {
    if (item.assignmentId) {
      const assignment = await ctx.db.get("assignments", item.assignmentId);
      if (!assignment) assignmentIds.add(item.assignmentId);
    }
    if (item.taskId) {
      const task = await ctx.db.get("tasks", item.taskId);
      if (!task) taskIds.add(item.taskId);
    }
  }
  if (assignmentIds.size === 0 && taskIds.size === 0) return undefined;
  const next = stripAgendaItemReferences(items, { assignmentIds, taskIds });
  return agendaItemsChanged(items, next) ? next : undefined;
}
