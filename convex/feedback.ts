import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel.js";
import { internalMutation, query, type QueryCtx } from "./_generated/server.js";
import { authz } from "./authz.js";
import { requireAppAdmin } from "./lib/admin.js";
import { authedMutation, authedQuery } from "./lib/customFunctions.js";
import { rateLimiter } from "./lib/rateLimiter.js";
import { isSelfHosted } from "./lib/selfHosted.js";

const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 4000;
const MAX_FIELD_LENGTH = 2000;
const MAX_ATTACHMENTS = 3;
const FEEDBACK_LIST_LIMIT = 100;

const feedbackTypeValidator = v.union(
  v.literal("bug"),
  v.literal("feature"),
  v.literal("concern"),
  v.literal("other"),
);

const severityValidator = v.union(v.literal("low"), v.literal("medium"), v.literal("high"));
const importanceValidator = v.union(
  v.literal("nice"),
  v.literal("important"),
  v.literal("critical"),
);

const attachmentPublicValidator = v.object({
  fileId: v.id("files"),
  name: v.string(),
  contentType: v.string(),
  url: v.union(v.string(), v.null()),
});

const feedbackAdminListItemValidator = v.object({
  _id: v.id("feedback"),
  type: feedbackTypeValidator,
  title: v.string(),
  body: v.string(),
  stepsToReproduce: v.optional(v.string()),
  expected: v.optional(v.string()),
  actual: v.optional(v.string()),
  severity: v.optional(severityValidator),
  useCase: v.optional(v.string()),
  proposedSolution: v.optional(v.string()),
  importance: v.optional(importanceValidator),
  impact: v.optional(v.string()),
  wantReply: v.boolean(),
  createdAt: v.number(),
  archivedAt: v.optional(v.number()),
  isSeed: v.optional(v.boolean()),
  userId: v.id("users"),
  userEmail: v.union(v.string(), v.null()),
  userName: v.optional(v.string()),
  attachments: v.array(attachmentPublicValidator),
});

function requireCloudOnly() {
  if (isSelfHosted()) {
    throw new ConvexError({
      code: "CLOUD_ONLY",
      message: "Feedback is only available on the cloud product",
    });
  }
}

function trimRequired(value: string, field: string, max: number): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: `${field} is required`,
    });
  }
  if (trimmed.length > max) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: `${field} is too long`,
    });
  }
  return trimmed;
}

function trimOptional(value: string | undefined, field: string, max: number): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: `${field} is too long`,
    });
  }
  return trimmed;
}

async function resolveAttachments(ctx: QueryCtx, fileIds: Id<"files">[]) {
  const attachments = [];
  for (const fileId of fileIds) {
    const file = await ctx.db.get("files", fileId);
    if (!file) continue;
    const url = await ctx.storage.getUrl(file.storageId);
    attachments.push({
      fileId,
      name: file.name,
      contentType: file.contentType,
      url,
    });
  }
  return attachments;
}

async function toAdminItem(ctx: QueryCtx, doc: Doc<"feedback">) {
  const user = await ctx.db.get("users", doc.userId);
  const attachments = await resolveAttachments(ctx, doc.attachmentFileIds);
  return {
    _id: doc._id,
    type: doc.type,
    title: doc.title,
    body: doc.body,
    stepsToReproduce: doc.stepsToReproduce,
    expected: doc.expected,
    actual: doc.actual,
    severity: doc.severity,
    useCase: doc.useCase,
    proposedSolution: doc.proposedSolution,
    importance: doc.importance,
    impact: doc.impact,
    wantReply: doc.wantReply,
    createdAt: doc.createdAt,
    archivedAt: doc.archivedAt,
    isSeed: doc.isSeed,
    userId: doc.userId,
    userEmail: user?.email?.trim() || null,
    userName: user?.name,
    attachments,
  };
}

/**
 * Soft check for cloud nav / route gating. Never throws.
 */
export const isFeedbackAdmin = query({
  args: {},
  returns: v.object({ isAdmin: v.boolean() }),
  handler: async (ctx) => {
    if (isSelfHosted()) {
      return { isAdmin: false };
    }
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { isAdmin: false };
    }
    const allowed = await authz.can(ctx, userId, "admin:viewFeedback");
    return { isAdmin: allowed };
  },
});

export const submit = authedMutation({
  args: {
    type: feedbackTypeValidator,
    title: v.string(),
    body: v.string(),
    stepsToReproduce: v.optional(v.string()),
    expected: v.optional(v.string()),
    actual: v.optional(v.string()),
    severity: v.optional(severityValidator),
    useCase: v.optional(v.string()),
    proposedSolution: v.optional(v.string()),
    importance: v.optional(importanceValidator),
    impact: v.optional(v.string()),
    wantReply: v.boolean(),
    attachmentFileIds: v.array(v.id("files")),
  },
  returns: v.id("feedback"),
  handler: async (ctx, args) => {
    requireCloudOnly();
    await rateLimiter.limit(ctx, "feedbackSubmitDaily", { key: ctx.userId, throws: true });
    await rateLimiter.limit(ctx, "feedbackSubmitWeekly", { key: ctx.userId, throws: true });

    const title = trimRequired(args.title, "title", MAX_TITLE_LENGTH);
    const body = trimRequired(args.body, "body", MAX_BODY_LENGTH);

    if (args.attachmentFileIds.length > MAX_ATTACHMENTS) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: `At most ${MAX_ATTACHMENTS} attachments are allowed`,
      });
    }
    const uniqueFileIds = [...new Set(args.attachmentFileIds)];
    if (uniqueFileIds.length !== args.attachmentFileIds.length) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "Duplicate attachments are not allowed",
      });
    }
    for (const fileId of uniqueFileIds) {
      const file = await ctx.db.get("files", fileId);
      if (!file || file.userId !== ctx.userId || file.classId !== undefined) {
        throw new ConvexError({
          code: "INVALID_ARGUMENT",
          message: "Attachment not found or not owned",
        });
      }
      if (file.preset !== "images") {
        throw new ConvexError({
          code: "INVALID_ARGUMENT",
          message: "Only image attachments are allowed",
        });
      }
    }

    const base = {
      userId: ctx.userId,
      type: args.type,
      title,
      body,
      wantReply: args.wantReply,
      attachmentFileIds: uniqueFileIds,
      createdAt: Date.now(),
    };

    if (args.type === "bug") {
      return await ctx.db.insert("feedback", {
        ...base,
        stepsToReproduce: trimOptional(args.stepsToReproduce, "stepsToReproduce", MAX_FIELD_LENGTH),
        expected: trimOptional(args.expected, "expected", MAX_FIELD_LENGTH),
        actual: trimOptional(args.actual, "actual", MAX_FIELD_LENGTH),
        severity: args.severity,
      });
    }
    if (args.type === "feature") {
      return await ctx.db.insert("feedback", {
        ...base,
        useCase: trimOptional(args.useCase, "useCase", MAX_FIELD_LENGTH),
        proposedSolution: trimOptional(args.proposedSolution, "proposedSolution", MAX_FIELD_LENGTH),
        importance: args.importance,
      });
    }
    if (args.type === "concern") {
      return await ctx.db.insert("feedback", {
        ...base,
        impact: trimOptional(args.impact, "impact", MAX_FIELD_LENGTH),
      });
    }
    return await ctx.db.insert("feedback", base);
  },
});

export const list = authedQuery({
  args: {
    archived: v.boolean(),
  },
  returns: v.array(feedbackAdminListItemValidator),
  handler: async (ctx, args) => {
    requireCloudOnly();
    await requireAppAdmin(ctx, "admin:viewFeedback");

    // Inbox is intentionally small (product owner).

    const all = await ctx.db.query("feedback").withIndex("by_createdAt").order("desc").take(500);

    const filtered = all
      .filter((row) =>
        args.archived ? row.archivedAt !== undefined : row.archivedAt === undefined,
      )
      .slice(0, FEEDBACK_LIST_LIMIT);

    return await Promise.all(filtered.map((row) => toAdminItem(ctx, row)));
  },
});

export const get = authedQuery({
  args: {
    feedbackId: v.id("feedback"),
  },
  returns: v.union(feedbackAdminListItemValidator, v.null()),
  handler: async (ctx, args) => {
    requireCloudOnly();
    await requireAppAdmin(ctx, "admin:viewFeedback");
    const doc = await ctx.db.get("feedback", args.feedbackId);
    if (!doc) return null;
    return await toAdminItem(ctx, doc);
  },
});

export const setArchived = authedMutation({
  args: {
    feedbackId: v.id("feedback"),
    archived: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireCloudOnly();
    await requireAppAdmin(ctx, "admin:viewFeedback");
    const doc = await ctx.db.get("feedback", args.feedbackId);
    if (!doc) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Feedback not found",
      });
    }
    if (args.archived) {
      if (doc.archivedAt === undefined) {
        await ctx.db.patch("feedback", args.feedbackId, { archivedAt: Date.now() });
      }
    } else if (doc.archivedAt !== undefined) {
      await ctx.db.patch("feedback", args.feedbackId, { archivedAt: undefined });
    }
    return null;
  },
});

/**
 * Insert sample feedback rows for admin UI testing.
 * PowerShell: `bunx convex run feedback:seedDemo '{\"userId\":\"...\"}'`
 * bash/zsh: `bunx convex run feedback:seedDemo '{"userId":"..."}'`
 */
export const seedDemo = internalMutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({ inserted: v.number() }),
  handler: async (ctx, args) => {
    requireCloudOnly();
    const user = await ctx.db.get("users", args.userId);
    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    const now = Date.now();
    const samples: Array<Omit<Doc<"feedback">, "_id" | "_creationTime">> = [
      {
        userId: args.userId,
        type: "bug",
        title: "[Seed] Join code redeem spinner never stops",
        body: "After entering a valid join code the button stays in a loading state even though the class appears on the home page.",
        stepsToReproduce: "1. Open /join\n2. Enter a valid code\n3. Submit",
        expected: "Navigate into the class or show success and idle button",
        actual: "Spinner continues until a full page refresh",
        severity: "high",
        wantReply: true,
        attachmentFileIds: [],
        createdAt: now - 2 * 60 * 60 * 1000,
        isSeed: true,
      },
      {
        userId: args.userId,
        type: "bug",
        title: "[Seed] Banner upload rejects valid WebP",
        body: "Uploading a small WebP as a class banner fails with invalid type on Chrome.",
        stepsToReproduce: "Upload a .webp under the image size limit",
        expected: "Upload succeeds",
        actual: "Error: file type is not allowed",
        severity: "medium",
        wantReply: false,
        attachmentFileIds: [],
        createdAt: now - 5 * 60 * 60 * 1000,
        isSeed: true,
      },
      {
        userId: args.userId,
        type: "feature",
        title: "[Seed] Bulk archive old classes",
        body: "I have many past school years and want to archive several classes at once.",
        useCase: "End-of-year cleanup without clicking archive on each class",
        proposedSolution: "Multi-select on the home dashboard with an Archive action",
        importance: "important",
        wantReply: false,
        attachmentFileIds: [],
        createdAt: now - 24 * 60 * 60 * 1000,
        isSeed: true,
      },
      {
        userId: args.userId,
        type: "feature",
        title: "[Seed] Printable student roster",
        body: "Would love a one-page PDF roster for substitutes.",
        useCase: "Hand a paper list to a cover teacher",
        proposedSolution: "Export button on the students page",
        importance: "nice",
        wantReply: true,
        attachmentFileIds: [],
        createdAt: now - 30 * 60 * 60 * 1000,
        isSeed: true,
      },
      {
        userId: args.userId,
        type: "concern",
        title: "[Seed] Trial ending email felt abrupt",
        body: "I only noticed the trial countdown after it was almost over.",
        impact: "Almost lost access mid-lesson planning",
        wantReply: true,
        attachmentFileIds: [],
        createdAt: now - 3 * 24 * 60 * 60 * 1000,
        isSeed: true,
      },
      {
        userId: args.userId,
        type: "other",
        title: "[Seed] Love the join display mode",
        body: "Just wanted to say the full-screen join code display works great on the classroom TV.",
        wantReply: false,
        attachmentFileIds: [],
        createdAt: now - 4 * 24 * 60 * 60 * 1000,
        isSeed: true,
      },
      {
        userId: args.userId,
        type: "concern",
        title: "[Seed] Archived sample concern",
        body: "This row is archived so you can test the Archived filter.",
        impact: "n/a — seed data",
        wantReply: false,
        attachmentFileIds: [],
        createdAt: now - 7 * 24 * 60 * 60 * 1000,
        archivedAt: now - 6 * 24 * 60 * 60 * 1000,
        isSeed: true,
      },
    ];

    for (const sample of samples) {
      await ctx.db.insert("feedback", sample);
    }
    return { inserted: samples.length };
  },
});

/**
 * Delete rows created by seedDemo (`isSeed: true`).
 * PowerShell: `bunx convex run feedback:clearDemo '{}'`
 */
export const clearDemo = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx) => {
    requireCloudOnly();
    const seeds = await ctx.db
      .query("feedback")
      .withIndex("by_isSeed", (q) => q.eq("isSeed", true))
      .take(200);
    for (const row of seeds) {
      await ctx.db.delete("feedback", row._id);
    }
    return { deleted: seeds.length };
  },
});
