import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel.js";
import { query, type MutationCtx, type QueryCtx } from "./_generated/server.js";
import {
  MAX_ANNOUNCEMENT_ATTACHMENTS,
  MAX_ANNOUNCEMENT_BODY_JSON_LENGTH,
  MAX_ANNOUNCEMENT_TITLE_LENGTH,
} from "./lib/announcementLimits.js";
import { recordClassActivity } from "./lib/classActivity.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import { rateLimiter } from "./lib/rateLimiter.js";

export {
  MAX_ANNOUNCEMENT_ATTACHMENTS,
  MAX_ANNOUNCEMENT_BODY_JSON_LENGTH,
  MAX_ANNOUNCEMENT_TITLE_LENGTH,
} from "./lib/announcementLimits.js";

const SLUG_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const SLUG_LENGTH = 21;
const SLUG_GENERATE_ATTEMPTS = 8;

const EMPTY_BODY_JSON = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });

const announcementAttachmentValidator = v.object({
  fileId: v.id("files"),
  name: v.string(),
  contentType: v.string(),
  size: v.number(),
  preset: v.string(),
});

const announcementValidator = v.object({
  _id: v.id("announcements"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  authorId: v.id("users"),
  title: v.string(),
  bodyJson: v.string(),
  isPublic: v.boolean(),
  publicSlug: v.optional(v.string()),
  attachmentFileIds: v.array(v.id("files")),
  attachments: v.array(announcementAttachmentValidator),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const publicAnnouncementValidator = v.object({
  title: v.string(),
  bodyJson: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
  attachments: v.array(
    v.object({
      fileId: v.id("files"),
      name: v.string(),
      contentType: v.string(),
      size: v.number(),
      url: v.union(v.string(), v.null()),
    }),
  ),
});

function normalizeTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new Error("Title is required");
  }
  if (trimmed.length > MAX_ANNOUNCEMENT_TITLE_LENGTH) {
    throw new Error(`Title must be at most ${MAX_ANNOUNCEMENT_TITLE_LENGTH} characters`);
  }
  return trimmed;
}

function normalizeBodyJson(bodyJson: string): string {
  const trimmed = bodyJson.trim();
  const value = trimmed.length > 0 ? trimmed : EMPTY_BODY_JSON;
  if (value.length > MAX_ANNOUNCEMENT_BODY_JSON_LENGTH) {
    throw new Error(`Body must be at most ${MAX_ANNOUNCEMENT_BODY_JSON_LENGTH} characters`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Invalid body");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid body");
  }
  const doc = parsed as { type?: unknown };
  if (doc.type !== "doc") {
    throw new Error("Invalid body");
  }
  return value;
}

function normalizeAttachmentFileIds(fileIds: Array<Id<"files">>): Array<Id<"files">> {
  const unique = [...new Set(fileIds)];
  if (unique.length > MAX_ANNOUNCEMENT_ATTACHMENTS) {
    throw new Error(`At most ${MAX_ANNOUNCEMENT_ATTACHMENTS} attachments allowed`);
  }
  return unique;
}

async function requireClassAttachmentFiles(
  ctx: MutationCtx,
  classId: Id<"classes">,
  fileIds: Array<Id<"files">>,
): Promise<void> {
  for (const fileId of fileIds) {
    const file = await ctx.db.get("files", fileId);
    // Uniform deny for missing vs wrong-class — avoid existence oracle.
    if (!file || file.classId !== classId) {
      throw new Error("File not found or access denied");
    }
    if (file.preset !== "images" && file.preset !== "documents") {
      throw new Error("Attachments must be images or documents");
    }
  }
}

function randomSlug(): string {
  const bytes = new Uint8Array(SLUG_LENGTH);
  crypto.getRandomValues(bytes);
  let result = "";
  for (const byte of bytes) {
    result += SLUG_ALPHABET[byte % SLUG_ALPHABET.length];
  }
  return result;
}

async function generateUniquePublicSlug(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < SLUG_GENERATE_ATTEMPTS; attempt += 1) {
    const publicSlug = randomSlug();
    const existing = await ctx.db
      .query("announcements")
      .withIndex("by_publicSlug", (q) => q.eq("publicSlug", publicSlug))
      .unique();
    if (!existing) {
      return publicSlug;
    }
  }
  throw new Error("Could not generate a unique public link");
}

async function loadAttachmentMeta(
  ctx: QueryCtx | MutationCtx,
  fileIds: Array<Id<"files">>,
): Promise<
  Array<{
    fileId: Id<"files">;
    name: string;
    contentType: string;
    size: number;
    preset: string;
  }>
> {
  const attachments: Array<{
    fileId: Id<"files">;
    name: string;
    contentType: string;
    size: number;
    preset: string;
  }> = [];
  for (const fileId of fileIds) {
    const file = await ctx.db.get("files", fileId);
    if (!file) continue;
    attachments.push({
      fileId: file._id,
      name: file.name,
      contentType: file.contentType,
      size: file.size,
      preset: file.preset,
    });
  }
  return attachments;
}

function toPublicAnnouncement(doc: Doc<"announcements">) {
  return {
    _id: doc._id,
    _creationTime: doc._creationTime,
    classId: doc.classId,
    authorId: doc.authorId,
    title: doc.title,
    bodyJson: doc.bodyJson,
    isPublic: doc.isPublic,
    publicSlug: doc.publicSlug,
    attachmentFileIds: doc.attachmentFileIds,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function requireAnnouncementInClass(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  announcementId: Id<"announcements">,
): Promise<Doc<"announcements">> {
  const announcement = await ctx.db.get("announcements", announcementId);
  if (!announcement || announcement.classId !== classId) {
    throw new ConvexError({
      code: "ANNOUNCEMENT_UNAVAILABLE",
      message: "Announcement not found or access denied",
    });
  }
  return announcement;
}

/**
 * List announcements for a class (newest first).
 */
export const list = classQuery({
  args: {},
  returns: v.array(announcementValidator),
  handler: async (ctx) => {
    const classId = ctx.classDoc._id;
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    const docs = await ctx.db
      .query("announcements")
      .withIndex("by_classId_createdAt", (q) => q.eq("classId", classId))
      .order("desc")
      .collect();

    const result = [];
    for (const doc of docs) {
      const attachments = await loadAttachmentMeta(ctx, doc.attachmentFileIds);
      result.push({
        ...toPublicAnnouncement(doc),
        attachments,
      });
    }
    return result;
  },
});

/**
 * Get a single announcement by id within a class.
 */
export const get = classQuery({
  args: {
    announcementId: v.id("announcements"),
  },
  returns: v.union(announcementValidator, v.null()),
  handler: async (ctx, args) => {
    const announcement = await ctx.db.get("announcements", args.announcementId);
    if (!announcement || announcement.classId !== ctx.classDoc._id) {
      return null;
    }
    const attachments = await loadAttachmentMeta(ctx, announcement.attachmentFileIds);
    return {
      ...toPublicAnnouncement(announcement),
      attachments,
    };
  },
});

/**
 * Soft-auth public page lookup. Returns null when missing or not public.
 * Unguessable slug entropy is the primary abuse control (queries are reactive).
 */
export const getByPublicSlug = query({
  args: {
    publicSlug: v.string(),
  },
  returns: v.union(publicAnnouncementValidator, v.null()),
  handler: async (ctx, args) => {
    const publicSlug = args.publicSlug.trim();
    if (!publicSlug || publicSlug.length > SLUG_LENGTH + 8) {
      return null;
    }
    const announcement = await ctx.db
      .query("announcements")
      .withIndex("by_publicSlug", (q) => q.eq("publicSlug", publicSlug))
      .unique();
    if (!announcement || !announcement.isPublic) {
      return null;
    }

    const attachments = [];
    for (const fileId of announcement.attachmentFileIds) {
      const file = await ctx.db.get("files", fileId);
      if (!file) continue;
      const url = await ctx.storage.getUrl(file.storageId);
      attachments.push({
        fileId: file._id,
        name: file.name,
        contentType: file.contentType,
        size: file.size,
        url,
      });
    }

    return {
      title: announcement.title,
      bodyJson: announcement.bodyJson,
      createdAt: announcement.createdAt,
      updatedAt: announcement.updatedAt,
      attachments,
    };
  },
});

export const create = classMutation({
  args: {
    title: v.string(),
    bodyJson: v.string(),
    attachmentFileIds: v.optional(v.array(v.id("files"))),
    isPublic: v.optional(v.boolean()),
  },
  returns: v.id("announcements"),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "announcementCreate", { key: ctx.userId, throws: true });
    await ctx.require("announcements:manage");

    const classId = ctx.classDoc._id;
    const title = normalizeTitle(args.title);
    const bodyJson = normalizeBodyJson(args.bodyJson);
    const attachmentFileIds = normalizeAttachmentFileIds(args.attachmentFileIds ?? []);
    await requireClassAttachmentFiles(ctx, classId, attachmentFileIds);

    const now = Date.now();
    const isPublic = args.isPublic === true;
    let publicSlug: string | undefined;
    if (isPublic) {
      publicSlug = await generateUniquePublicSlug(ctx);
    }

    const announcementId = await ctx.db.insert("announcements", {
      classId,
      authorId: ctx.userId,
      title,
      bodyJson,
      isPublic,
      ...(publicSlug !== undefined ? { publicSlug } : {}),
      attachmentFileIds,
      createdAt: now,
      updatedAt: now,
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "announcement",
      resourceId: announcementId,
      summary: `Created announcement "${title}"`,
      summaryKey: "activitySummary_createdAnnouncement",
      metadata: { name: title },
    });

    if (isPublic) {
      await recordClassActivity(ctx, {
        classId,
        actorUserId: ctx.userId,
        action: "update",
        resourceType: "announcement",
        resourceId: announcementId,
        summary: `Published announcement "${title}"`,
        summaryKey: "activitySummary_publishedAnnouncement",
        metadata: { name: title },
      });
    }

    return announcementId;
  },
});

export const update = classMutation({
  args: {
    announcementId: v.id("announcements"),
    title: v.string(),
    bodyJson: v.string(),
    attachmentFileIds: v.optional(v.array(v.id("files"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "announcementUpdate", { key: ctx.userId, throws: true });
    await ctx.require("announcements:manage");

    const classId = ctx.classDoc._id;
    const existing = await requireAnnouncementInClass(ctx, classId, args.announcementId);
    const title = normalizeTitle(args.title);
    const bodyJson = normalizeBodyJson(args.bodyJson);
    const attachmentFileIds = normalizeAttachmentFileIds(
      args.attachmentFileIds ?? existing.attachmentFileIds,
    );
    await requireClassAttachmentFiles(ctx, classId, attachmentFileIds);

    await ctx.db.patch("announcements", args.announcementId, {
      title,
      bodyJson,
      attachmentFileIds,
      updatedAt: Date.now(),
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "announcement",
      resourceId: args.announcementId,
      summary: `Updated announcement "${title}"`,
      summaryKey: "activitySummary_updatedAnnouncement",
      metadata: { name: title },
    });

    return null;
  },
});

export const remove = classMutation({
  args: {
    announcementId: v.id("announcements"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "announcementRemove", { key: ctx.userId, throws: true });
    await ctx.require("announcements:manage");

    const classId = ctx.classDoc._id;
    const existing = await requireAnnouncementInClass(ctx, classId, args.announcementId);
    await ctx.db.delete("announcements", args.announcementId);

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "announcement",
      resourceId: args.announcementId,
      summary: `Deleted announcement "${existing.title}"`,
      summaryKey: "activitySummary_deletedAnnouncement",
      metadata: { name: existing.title },
    });

    return null;
  },
});

export const setPublic = classMutation({
  args: {
    announcementId: v.id("announcements"),
    isPublic: v.boolean(),
  },
  returns: v.object({
    isPublic: v.boolean(),
    publicSlug: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "announcementSetPublic", { key: ctx.userId, throws: true });
    await ctx.require("announcements:manage");

    const classId = ctx.classDoc._id;
    const existing = await requireAnnouncementInClass(ctx, classId, args.announcementId);

    let publicSlug = existing.publicSlug;
    if (args.isPublic && publicSlug === undefined) {
      publicSlug = await generateUniquePublicSlug(ctx);
    }

    await ctx.db.patch("announcements", args.announcementId, {
      isPublic: args.isPublic,
      ...(publicSlug !== undefined ? { publicSlug } : {}),
      updatedAt: Date.now(),
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "announcement",
      resourceId: args.announcementId,
      summary: args.isPublic
        ? `Published announcement "${existing.title}"`
        : `Unpublished announcement "${existing.title}"`,
      summaryKey: args.isPublic
        ? "activitySummary_publishedAnnouncement"
        : "activitySummary_unpublishedAnnouncement",
      metadata: { name: existing.title },
    });

    return {
      isPublic: args.isPublic,
      ...(publicSlug !== undefined ? { publicSlug } : {}),
    };
  },
});
