import { v } from "convex/values";

import type { Id } from "../../_generated/dataModel.js";
import type { MutationCtx } from "../../_generated/server.js";
import {
  CALENDAR_AUDIENCE_ROLES,
  uniqueAudienceRoles,
  type CalendarAudienceRole,
} from "../calendar/audience.js";
import type { LessonLinkInput } from "./timetableSchema.js";

export const MAX_SECTION_ITEMS = 20;
export const MAX_ITEM_TEXT_LENGTH = 500;
export const MAX_TAGS_PER_ITEM = 10;
export const MAX_TAG_LENGTH = 40;
export const MAX_TAG_DICTIONARY = 200;
export const DEFAULT_CALENDAR_AUDIENCE_ROLES: ReadonlyArray<CalendarAudienceRole> = ["student"];

export const HASHTAG_RE = /#([A-Za-z0-9_][A-Za-z0-9_-]{0,39})/g;
const URL_IN_TEXT_RE = /https?:\/\/[^\s]+/gi;

export const sectionItemValidator = v.object({
  key: v.string(),
  text: v.string(),
  tags: v.array(v.string()),
});

export const agendaItemValidator = v.object({
  key: v.string(),
  text: v.string(),
  tags: v.array(v.string()),
  assignmentId: v.optional(v.id("assignments")),
  taskId: v.optional(v.id("tasks")),
  preface: v.optional(v.string()),
});

export const agendaDisplayItemValidator = v.object({
  key: v.string(),
  text: v.string(),
  tags: v.array(v.string()),
  assignmentId: v.optional(v.id("assignments")),
  taskId: v.optional(v.id("tasks")),
  preface: v.optional(v.string()),
  assignmentName: v.optional(v.string()),
  taskName: v.optional(v.string()),
});

export const calendarAudienceRoleValidator = v.union(
  v.literal("owner"),
  v.literal("teacher"),
  v.literal("assistant_teacher"),
  v.literal("student"),
  v.literal("guardian"),
);

export type SectionItem = {
  key: string;
  text: string;
  tags: Array<string>;
};

export type AgendaItem = SectionItem & {
  assignmentId?: Id<"assignments">;
  taskId?: Id<"tasks">;
  preface?: string;
};

export type AgendaDisplayItem = AgendaItem & {
  assignmentName?: string;
  taskName?: string;
};

export function attachAgendaResourceNames(
  items: ReadonlyArray<AgendaItem>,
  names: {
    assignments: ReadonlyMap<string, string>;
    tasks: ReadonlyMap<string, string>;
  },
): Array<AgendaDisplayItem> {
  return items.map((item) => {
    const assignmentName = item.assignmentId ? names.assignments.get(item.assignmentId) : undefined;
    const taskName = item.taskId ? names.tasks.get(item.taskId) : undefined;
    return {
      ...item,
      ...(assignmentName ? { assignmentName } : {}),
      ...(taskName ? { taskName } : {}),
    };
  });
}

export function stripAgendaItemReferences(
  items: ReadonlyArray<AgendaItem>,
  refs: {
    assignmentIds?: ReadonlySet<string>;
    taskIds?: ReadonlySet<string>;
  },
): Array<AgendaItem> {
  const result: Array<AgendaItem> = [];
  for (const item of items) {
    const assignmentId =
      item.assignmentId && refs.assignmentIds?.has(item.assignmentId)
        ? undefined
        : item.assignmentId;
    const taskId = item.taskId && refs.taskIds?.has(item.taskId) ? undefined : item.taskId;
    if (!assignmentId && !taskId && !item.text.trim()) continue;
    result.push({
      key: item.key,
      text: item.text,
      tags: item.tags,
      ...(assignmentId ? { assignmentId } : {}),
      ...(taskId ? { taskId } : {}),
      ...prefaceFields(item.preface),
    });
  }
  return result;
}

export function agendaItemsChanged(
  before: ReadonlyArray<AgendaItem>,
  after: ReadonlyArray<AgendaItem>,
): boolean {
  if (before.length !== after.length) return true;
  return before.some((item, index) => {
    const next = after[index];
    if (!next) return true;
    return (
      item.key !== next.key ||
      item.text !== next.text ||
      item.assignmentId !== next.assignmentId ||
      item.taskId !== next.taskId ||
      item.preface !== next.preface
    );
  });
}

export type AgendaItemInput = SectionItem & {
  assignmentId?: string;
  taskId?: string;
  preface?: string;
};

export function exclusiveAgendaLinkIds(item: {
  assignmentId?: Id<"assignments">;
  taskId?: Id<"tasks">;
}): { assignmentId?: Id<"assignments">; taskId?: Id<"tasks"> } {
  if (item.taskId) return { taskId: item.taskId };
  if (item.assignmentId) return { assignmentId: item.assignmentId };
  return {};
}

export function prefaceFields(preface: string | undefined): { preface?: string } {
  return preface ? { preface } : {};
}

export function normalizePreface(preface: string | undefined): string | undefined {
  const trimmed = preface?.trim() ?? "";
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_ITEM_TEXT_LENGTH) {
    throw new Error(`Item text must be at most ${MAX_ITEM_TEXT_LENGTH} characters`);
  }
  return trimmed;
}

export function toAgendaItems(items: ReadonlyArray<AgendaItemInput>): Array<AgendaItem> {
  return items.map((item) => ({
    key: item.key,
    text: item.text,
    tags: item.tags,
    ...exclusiveAgendaLinkIds({
      ...(item.assignmentId ? { assignmentId: item.assignmentId as Id<"assignments"> } : {}),
      ...(item.taskId ? { taskId: item.taskId as Id<"tasks"> } : {}),
    }),
    ...prefaceFields(item.preface?.trim()),
  }));
}

export type LessonSectionContent = {
  materials: Array<SectionItem>;
  announcements: Array<SectionItem>;
  agenda: Array<AgendaItem>;
};

export function normalizeTag(raw: string): string {
  const trimmed = raw.trim().replace(/^#/, "");
  return trimmed.toLowerCase();
}

export function isValidTag(raw: string): boolean {
  const tag = normalizeTag(raw);
  if (!tag || tag.length > MAX_TAG_LENGTH) return false;
  return /^[a-z0-9_][a-z0-9_-]*$/.test(tag);
}

export function extractHashtags(text: string): Array<string> {
  const seen = new Set<string>();
  const tags: Array<string> = [];
  const matcher = new RegExp(HASHTAG_RE.source, "g");
  let match = matcher.exec(text);
  while (match) {
    const tag = normalizeTag(match[1] ?? "");
    if (isValidTag(tag) && !seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
      if (tags.length >= MAX_TAGS_PER_ITEM) break;
    }
    match = matcher.exec(text);
  }
  return tags;
}

export function collectItemTags(
  items: ReadonlyArray<{ tags?: ReadonlyArray<string>; text: string }>,
) {
  const seen = new Set<string>();
  const tags: Array<string> = [];
  for (const item of items) {
    const fromItem = item.tags && item.tags.length > 0 ? item.tags : extractHashtags(item.text);
    for (const raw of fromItem) {
      const tag = normalizeTag(raw);
      if (!isValidTag(tag) || seen.has(tag)) continue;
      seen.add(tag);
      tags.push(tag);
    }
  }
  return tags;
}

function normalizeItemKey(key: string, used: Set<string>): string {
  const trimmed = key.trim();
  if (!trimmed) throw new Error("Item key is required");
  if (used.has(trimmed)) throw new Error("Duplicate item key");
  used.add(trimmed);
  return trimmed;
}

function normalizeItemText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length > MAX_ITEM_TEXT_LENGTH) {
    throw new Error(`Item text must be at most ${MAX_ITEM_TEXT_LENGTH} characters`);
  }
  return trimmed;
}

function normalizeStoredTags(text: string, tags: ReadonlyArray<string> | undefined): Array<string> {
  const fromText = extractHashtags(text);
  const extra = (tags ?? [])
    .map(normalizeTag)
    .filter((tag) => isValidTag(tag) && !fromText.includes(tag));
  return [...fromText, ...extra].slice(0, MAX_TAGS_PER_ITEM);
}

export function normalizeSectionItems(
  items: ReadonlyArray<SectionItem> | undefined,
): Array<SectionItem> {
  if (!items || items.length === 0) return [];
  if (items.length > MAX_SECTION_ITEMS) {
    throw new Error(`At most ${MAX_SECTION_ITEMS} items are allowed`);
  }
  const used = new Set<string>();
  const normalized: Array<SectionItem> = [];
  for (const item of items) {
    const text = normalizeItemText(item.text);
    if (!text) continue;
    normalized.push({
      key: normalizeItemKey(item.key, used),
      text,
      tags: normalizeStoredTags(text, item.tags),
    });
  }
  return normalized;
}

export async function normalizeAgendaItems(
  ctx: MutationCtx,
  classId: Id<"classes">,
  items: ReadonlyArray<AgendaItemInput> | undefined,
): Promise<Array<AgendaItem>> {
  if (!items || items.length === 0) return [];
  if (items.length > MAX_SECTION_ITEMS) {
    throw new Error(`At most ${MAX_SECTION_ITEMS} items are allowed`);
  }
  const used = new Set<string>();
  const normalized: Array<AgendaItem> = [];
  for (const item of toAgendaItems(items)) {
    const text = normalizeItemText(item.text);
    if (!text && !item.assignmentId && !item.taskId) continue;
    if (item.assignmentId) {
      const assignment = await ctx.db.get("assignments", item.assignmentId);
      if (!assignment || assignment.classId !== classId) {
        throw new Error("Assignment not found");
      }
    }
    if (item.taskId) {
      const task = await ctx.db.get("tasks", item.taskId);
      if (!task || task.classId !== classId) {
        throw new Error("Task not found");
      }
    }
    normalized.push({
      key: normalizeItemKey(item.key, used),
      text,
      tags: normalizeStoredTags(text, item.tags),
      ...(item.assignmentId ? { assignmentId: item.assignmentId } : {}),
      ...(item.taskId ? { taskId: item.taskId } : {}),
      ...prefaceFields(normalizePreface(item.preface)),
    });
  }
  return normalized;
}

export function normalizeCalendarAudienceRoles(
  roles: ReadonlyArray<string> | undefined,
): Array<CalendarAudienceRole> {
  if (!roles || roles.length === 0) {
    return [...DEFAULT_CALENDAR_AUDIENCE_ROLES];
  }
  return uniqueAudienceRoles(roles);
}

export function defaultSubjectSections(): LessonSectionContent & {
  calendarAudienceRoles: Array<CalendarAudienceRole>;
} {
  return {
    materials: [],
    announcements: [],
    agenda: [],
    calendarAudienceRoles: [...DEFAULT_CALENDAR_AUDIENCE_ROLES],
  };
}

export function emptyLessonSections(): LessonSectionContent {
  return { materials: [], announcements: [], agenda: [] };
}

export function copySubjectDefaults(subject: {
  defaultMaterials?: Array<SectionItem>;
  defaultAnnouncements?: Array<SectionItem>;
  defaultAgenda?: Array<AgendaItem>;
}): LessonSectionContent {
  return {
    materials: subject.defaultMaterials ?? [],
    announcements: subject.defaultAnnouncements ?? [],
    agenda: subject.defaultAgenda ?? [],
  };
}

export function lessonSectionsEqual(a: LessonSectionContent, b: LessonSectionContent): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function migrateLegacyLinks(links: ReadonlyArray<LessonLinkInput> | undefined): {
  materials: Array<SectionItem>;
  agenda: Array<AgendaItem>;
} {
  const materials: Array<SectionItem> = [];
  const agenda: Array<AgendaItem> = [];
  if (!links) return { materials, agenda };

  for (const link of links) {
    if (link.kind === "url") {
      const url = link.url?.trim() ?? "";
      const label = link.label?.trim();
      const text = label && url && !label.includes(url) ? `${label} ${url}` : label || url;
      if (!text) continue;
      materials.push({
        key: link.key,
        text: text.slice(0, MAX_ITEM_TEXT_LENGTH),
        tags: extractHashtags(text),
      });
      continue;
    }

    const label = link.label?.trim() ?? "";
    agenda.push({
      key: link.key,
      text: label.slice(0, MAX_ITEM_TEXT_LENGTH),
      tags: extractHashtags(label),
      ...(link.kind === "assignment" && link.assignmentId
        ? { assignmentId: link.assignmentId }
        : {}),
      ...(link.kind === "task" && link.taskId ? { taskId: link.taskId } : {}),
    });
  }

  return {
    materials: materials.slice(0, MAX_SECTION_ITEMS),
    agenda: agenda.slice(0, MAX_SECTION_ITEMS),
  };
}

export function hasSectionContent(content: LessonSectionContent): boolean {
  return (
    content.materials.length > 0 || content.announcements.length > 0 || content.agenda.length > 0
  );
}

export function splitTextWithUrls(text: string): Array<{ type: "text" | "url"; value: string }> {
  const parts: Array<{ type: "text" | "url"; value: string }> = [];
  const matcher = new RegExp(URL_IN_TEXT_RE.source, "gi");
  let lastIndex = 0;
  let match = matcher.exec(text);
  while (match) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "url", value: match[0] ?? "" });
    lastIndex = matcher.lastIndex;
    match = matcher.exec(text);
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }
  return parts;
}

export async function upsertClassTags(
  ctx: MutationCtx,
  classId: Id<"classes">,
  tags: ReadonlyArray<string>,
): Promise<void> {
  const now = Date.now();
  for (const raw of tags) {
    const tag = normalizeTag(raw);
    if (!isValidTag(tag)) continue;
    const existing = await ctx.db
      .query("timetableTags")
      .withIndex("by_classId_tag", (q) => q.eq("classId", classId).eq("tag", tag))
      .unique();
    if (existing) {
      if (existing.display !== raw.replace(/^#/, "") || existing.updatedAt !== now) {
        await ctx.db.patch("timetableTags", existing._id, {
          display: raw.replace(/^#/, ""),
          updatedAt: now,
        });
      }
      continue;
    }
    await ctx.db.insert("timetableTags", {
      classId,
      tag,
      display: raw.replace(/^#/, ""),
      updatedAt: now,
    });
  }
}

export function calendarAudienceRolesOrDefault(
  roles: ReadonlyArray<string> | undefined,
): Array<CalendarAudienceRole> {
  if (!roles || roles.length === 0) return [...DEFAULT_CALENDAR_AUDIENCE_ROLES];
  return CALENDAR_AUDIENCE_ROLES.filter((role) => roles.includes(role));
}
