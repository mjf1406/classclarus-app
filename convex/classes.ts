import { v } from "convex/values";

import { authz } from "./authz.js";
import { APP_CONFIG } from "./appConfig.js";
import { components, internal } from "./_generated/api.js";
import type { Doc, Id } from "./_generated/dataModel.js";
import type { MutationCtx } from "./_generated/server.js";
import {
  CLASS_ROLES,
  classScope,
  isClassRole,
  pickHighestClassRole,
  type ClassRole,
} from "./lib/authzModel.js";
import { recordClassActivity } from "./lib/classActivity.js";
import { clearClassPermissionOverrides } from "./lib/classPermissionOverrides.js";
import { authedQuery, classMutation, classQuery, entitledMutation } from "./lib/customFunctions.js";
import { rateLimiter } from "./lib/rateLimiter.js";
import { clearLinksForClass } from "./lib/guardianLinks.js";
import { deleteFilesForClass } from "./lib/filesCleanup.js";
import { deleteAnnouncementsForClass } from "./lib/announcementsCleanup.js";
import { deleteAttendanceForClass } from "./lib/attendanceCleanup.js";
import { deleteGroupsForClass } from "./lib/groupsCleanup.js";
import { deleteTasksForClass } from "./lib/tasksCleanup.js";
import { deleteAssignmentsForClass } from "./lib/assignmentsCleanup.js";
import { deleteExpectationsForClass } from "./lib/expectationsCleanup.js";
import { deleteGradeScalesForClass } from "./lib/gradeScalesCleanup.js";
import { deleteGradedSubjectsForClass } from "./lib/gradedSubjectsCleanup.js";
import { deleteRandomAssignersForClass } from "./lib/randomAssignersCleanup.js";
import { deleteBehaviorsForClass } from "./lib/behaviorsCleanup.js";
import { deleteRewardsForClass } from "./lib/rewardsCleanup.js";
import { deleteWarningEventsForClass } from "./lib/pointsCleanup.js";
import { deleteJoinCodesForClass } from "./lib/joinCodesCleanup.js";
import { languageValidator, type LanguageCode } from "./lib/languages.js";
import {
  normalizePointsBadgeWindow,
  pointsBadgeWindowUnitValidator,
  resolvePointsBadgeWindow,
  type PointsBadgeWindowUnit,
} from "./lib/pointsBadgeWindow.js";
import {
  deleteClassUserSettingsForClass,
  deleteStudentRostersForClass,
} from "./lib/studentRosters.js";
import { resolveUserImageUrl } from "./lib/userImage.js";

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_ICON_LENGTH = 32;

const classRoleValidator = v.union(
  v.literal("owner"),
  v.literal("teacher"),
  v.literal("assistant_teacher"),
  v.literal("student"),
  v.literal("guardian"),
  v.literal("class_member"),
);

const rosterNameOrderValidator = v.union(v.literal("firstLast"), v.literal("lastFirst"));

const POINTS_PUBLIC_SLUG_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const POINTS_PUBLIC_SLUG_LENGTH = 21;
const POINTS_PUBLIC_SLUG_GENERATE_ATTEMPTS = 8;

const classValidator = v.object({
  _id: v.id("classes"),
  _creationTime: v.number(),
  ownerId: v.id("users"),
  name: v.string(),
  year: v.number(),
  description: v.optional(v.string()),
  icon: v.optional(v.string()),
  bannerFileId: v.optional(v.id("files")),
  studentLanguage: languageValidator,
  rosterNameOrder: rosterNameOrderValidator,
  rosterNameSpace: v.boolean(),
  warningWindowAmount: v.number(),
  warningWindowUnit: pointsBadgeWindowUnitValidator,
  minusWindowAmount: v.number(),
  minusWindowUnit: pointsBadgeWindowUnitValidator,
  pointsPublicEnabled: v.optional(v.boolean()),
  pointsPublicSlug: v.optional(v.string()),
  updatedAt: v.number(),
  archivedAt: v.optional(v.number()),
});

function randomPointsPublicSlug(): string {
  const bytes = new Uint8Array(POINTS_PUBLIC_SLUG_LENGTH);
  crypto.getRandomValues(bytes);
  let result = "";
  for (const byte of bytes) {
    result += POINTS_PUBLIC_SLUG_ALPHABET[byte % POINTS_PUBLIC_SLUG_ALPHABET.length];
  }
  return result;
}

async function generateUniquePointsPublicSlug(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < POINTS_PUBLIC_SLUG_GENERATE_ATTEMPTS; attempt += 1) {
    const pointsPublicSlug = randomPointsPublicSlug();
    const existing = await ctx.db
      .query("classes")
      .withIndex("by_pointsPublicSlug", (q) => q.eq("pointsPublicSlug", pointsPublicSlug))
      .unique();
    if (!existing) {
      return pointsPublicSlug;
    }
  }
  throw new Error("Could not generate a unique public display link");
}

type ClassPublicDefaults = {
  studentLanguage: LanguageCode;
  rosterNameOrder: "firstLast" | "lastFirst";
  rosterNameSpace: boolean;
  warningWindowAmount: number;
  warningWindowUnit: PointsBadgeWindowUnit;
  minusWindowAmount: number;
  minusWindowUnit: PointsBadgeWindowUnit;
};

function resolvePointsBadgeWindowFields(classDoc: Doc<"classes">): {
  warningWindowAmount: number;
  warningWindowUnit: PointsBadgeWindowUnit;
  minusWindowAmount: number;
  minusWindowUnit: PointsBadgeWindowUnit;
} {
  const warning = resolvePointsBadgeWindow(
    classDoc.warningWindowAmount,
    classDoc.warningWindowUnit,
  );
  const minus = resolvePointsBadgeWindow(classDoc.minusWindowAmount, classDoc.minusWindowUnit);
  return {
    warningWindowAmount: warning.amount,
    warningWindowUnit: warning.unit,
    minusWindowAmount: minus.amount,
    minusWindowUnit: minus.unit,
  };
}

/** API always returns resolved defaults for optional/legacy class fields. */
function withClassDefaults(classDoc: Doc<"classes">): Doc<"classes"> & ClassPublicDefaults {
  return {
    ...classDoc,
    studentLanguage: classDoc.studentLanguage ?? "en",
    rosterNameOrder: classDoc.rosterNameOrder === "lastFirst" ? "lastFirst" : "firstLast",
    rosterNameSpace: classDoc.rosterNameSpace !== false,
    ...resolvePointsBadgeWindowFields(classDoc),
  };
}

const classWithRoleValidator = classValidator.extend({
  role: classRoleValidator,
});

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Class name is required");
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new Error(`Class name must be at most ${MAX_NAME_LENGTH} characters`);
  }
  return trimmed;
}

function normalizeYear(year: number): number {
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw new Error(`Year must be an integer between ${MIN_YEAR} and ${MAX_YEAR}`);
  }
  return year;
}

function normalizeDescription(description: string | undefined): string | undefined {
  if (description === undefined) {
    return undefined;
  }
  const trimmed = description.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
  }
  return trimmed;
}

function normalizeIcon(icon: string | undefined): string | undefined {
  if (icon === undefined) {
    return undefined;
  }
  const trimmed = icon.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.length > MAX_ICON_LENGTH) {
    throw new Error(`Icon must be at most ${MAX_ICON_LENGTH} characters`);
  }
  const isFontAwesome = /^(fas|far):[a-z0-9-]+$/i.test(trimmed);
  // Allow a single grapheme emoji (or short emoji sequence) as an alternative to FA ids.
  const isEmoji = !trimmed.includes(":") && /\p{Extended_Pictographic}/u.test(trimmed);
  if (!isFontAwesome && !isEmoji) {
    throw new Error("Icon must be a Font Awesome id or emoji");
  }
  return trimmed;
}

function deleteConfirmationPhrase(name: string): string {
  return `delete ${name}`;
}

async function revokeAllClassMembership(ctx: MutationCtx, classId: Id<"classes">): Promise<void> {
  const scope = classScope(classId);
  const userIds = new Set<string>();
  for (const role of CLASS_ROLES) {
    const users = await ctx.runQuery(components.authz.queries.getUsersWithRole, {
      tenantId: APP_CONFIG.authzTenantId,
      role,
      scope,
    });
    for (const user of users) {
      userIds.add(user.userId);
    }
  }
  for (const userId of userIds) {
    await authz.offboardUser(ctx, userId, {
      scope,
      removeOverrides: true,
      removeRelationships: true,
      removeAttributes: false,
    });
  }
}

export const listMine = authedQuery({
  args: {},
  returns: v.array(classWithRoleValidator),
  handler: async (ctx) => {
    const roleEntries = await authz.getUserRoles(ctx, ctx.userId);
    const rolesByClassId = new Map<string, Array<string>>();

    for (const entry of roleEntries) {
      let classId: string | null = null;
      if (entry.scope?.type === "class") {
        classId = entry.scope.id;
      } else if (typeof entry.scopeKey === "string" && entry.scopeKey.startsWith("class:")) {
        classId = entry.scopeKey.slice("class:".length);
      }
      if (!classId) continue;
      const existing = rolesByClassId.get(classId) ?? [];
      existing.push(entry.role);
      rolesByClassId.set(classId, existing);
    }

    const results: Array<Doc<"classes"> & ClassPublicDefaults & { role: ClassRole }> = [];

    for (const [classId, roleNames] of rolesByClassId) {
      const scope = classScope(classId);
      const canRead = await authz.can(ctx, ctx.userId, "class:read", scope);
      if (!canRead) continue;

      const role = pickHighestClassRole(roleNames.filter(isClassRole));
      if (!role) continue;

      const classDoc = await ctx.db.get("classes", classId as Id<"classes">);
      if (!classDoc) continue;

      results.push({ ...withClassDefaults(classDoc), role });
    }

    return results;
  },
});

/**
 * Classes owned by the current user.
 * Intentionally ungated by entitlement so expired owners can still transfer or
 * delete classes from /account (exit path for the owns_classes deletion blocker).
 */
export const listOwned = authedQuery({
  args: {},
  returns: v.array(classValidator),
  handler: async (ctx) => {
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- owned classes per user are bounded
    const owned = await ctx.db
      .query("classes")
      .withIndex("by_owner", (q) => q.eq("ownerId", ctx.userId))
      .collect();
    return owned.map(withClassDefaults);
  },
});

export const get = authedQuery({
  args: { classId: v.id("classes") },
  returns: v.union(classValidator, v.null()),
  handler: async (ctx, args) => {
    const classDoc = await ctx.db.get("classes", args.classId);
    if (!classDoc) {
      return null;
    }
    const canRead = await authz.can(ctx, ctx.userId, "class:read", classScope(args.classId));
    if (!canRead) {
      return null;
    }
    return withClassDefaults(classDoc);
  },
});

export const create = entitledMutation({
  args: {
    name: v.string(),
    year: v.number(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    studentLanguage: languageValidator,
  },
  returns: classValidator,
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "classCreateGlobal", { key: "global", throws: true });
    await rateLimiter.limit(ctx, "classCreate", { key: ctx.userId, throws: true });
    const now = Date.now();
    const classId = await ctx.db.insert("classes", {
      ownerId: ctx.userId,
      name: normalizeName(args.name),
      year: normalizeYear(args.year),
      description: normalizeDescription(args.description),
      icon: normalizeIcon(args.icon),
      studentLanguage: args.studentLanguage,
      updatedAt: now,
    });
    await authz.assignRole(ctx, ctx.userId, "owner", classScope(classId));
    const created = await ctx.db.get("classes", classId);
    if (!created) {
      throw new Error("Failed to create class");
    }
    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "class",
      resourceId: classId,
      summary: `Created class "${created.name}"`,
      summaryKey: "activitySummary_createdClass",
      metadata: { name: created.name, year: String(created.year) },
    });
    return withClassDefaults(created);
  },
});

export const update = classMutation({
  args: {
    name: v.string(),
    year: v.number(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  returns: classValidator,
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "classUpdate", { key: ctx.userId, throws: true });
    await ctx.require("class:update");
    await ctx.db.patch("classes", ctx.classDoc._id, {
      name: normalizeName(args.name),
      year: normalizeYear(args.year),
      description: normalizeDescription(args.description),
      icon: normalizeIcon(args.icon),
      updatedAt: Date.now(),
    });
    const updated = await ctx.db.get("classes", ctx.classDoc._id);
    if (!updated) {
      throw new Error("Failed to update class");
    }
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "class",
      resourceId: ctx.classDoc._id,
      summary: `Updated class settings for "${updated.name}"`,
      summaryKey: "activitySummary_updatedClassSettings",
      metadata: { name: updated.name, year: String(updated.year) },
    });
    return withClassDefaults(updated);
  },
});

export const setArchived = classMutation({
  args: {
    archived: v.boolean(),
  },
  returns: classValidator,
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "classArchive", { key: ctx.userId, throws: true });
    await ctx.require("class:archive");
    await ctx.db.patch("classes", ctx.classDoc._id, {
      archivedAt: args.archived ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
    const updated = await ctx.db.get("classes", ctx.classDoc._id);
    if (!updated) {
      throw new Error("Failed to update class archive state");
    }
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "class",
      resourceId: ctx.classDoc._id,
      summary: args.archived
        ? `Archived class "${ctx.classDoc.name}"`
        : `Unarchived class "${ctx.classDoc.name}"`,
      summaryKey: args.archived
        ? "activitySummary_archivedClass"
        : "activitySummary_unarchivedClass",
      metadata: { name: ctx.classDoc.name, archived: String(args.archived) },
    });
    return withClassDefaults(updated);
  },
});

export const setBanner = classMutation({
  args: {
    fileId: v.id("files"),
  },
  returns: classValidator,
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "classUpdate", { key: ctx.userId, throws: true });
    await ctx.require("class:update");

    const file = await ctx.db.get("files", args.fileId);
    // Uniform deny for missing vs wrong-class — avoid existence oracle.
    if (!file || file.classId !== ctx.classDoc._id) {
      throw new Error("File not found or access denied");
    }
    if (file.preset !== "images") {
      throw new Error("Banner must be an image");
    }

    await ctx.db.patch("classes", ctx.classDoc._id, {
      bannerFileId: args.fileId,
      updatedAt: Date.now(),
    });
    const updated = await ctx.db.get("classes", ctx.classDoc._id);
    if (!updated) {
      throw new Error("Failed to set class banner");
    }
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "class",
      resourceId: ctx.classDoc._id,
      summary: `Set dashboard banner for "${ctx.classDoc.name}"`,
      summaryKey: "activitySummary_setDashboardBanner",
      metadata: { name: ctx.classDoc.name, fileId: args.fileId, fileName: file.name },
    });
    return withClassDefaults(updated);
  },
});

export const setStudentLanguage = classMutation({
  args: {
    studentLanguage: languageValidator,
  },
  returns: classValidator,
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "classUpdate", { key: ctx.userId, throws: true });
    await ctx.require("class:update");
    await ctx.db.patch("classes", ctx.classDoc._id, {
      studentLanguage: args.studentLanguage,
      updatedAt: Date.now(),
    });
    const updated = await ctx.db.get("classes", ctx.classDoc._id);
    if (!updated) {
      throw new Error("Failed to update student language");
    }
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "class",
      resourceId: ctx.classDoc._id,
      summary: `Set student language to ${args.studentLanguage}`,
      summaryKey: "activitySummary_setStudentLanguage",
      metadata: { studentLanguage: args.studentLanguage },
    });
    return withClassDefaults(updated);
  },
});

/**
 * Class-wide roster name display: first/last order and whether to insert a space.
 */
export const setRosterNameFormat = classMutation({
  args: {
    rosterNameOrder: rosterNameOrderValidator,
    rosterNameSpace: v.boolean(),
  },
  returns: classValidator,
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "classUpdate", { key: ctx.userId, throws: true });
    await ctx.require("class:update");
    await ctx.db.patch("classes", ctx.classDoc._id, {
      rosterNameOrder: args.rosterNameOrder,
      rosterNameSpace: args.rosterNameSpace,
      updatedAt: Date.now(),
    });
    const updated = await ctx.db.get("classes", ctx.classDoc._id);
    if (!updated) {
      throw new Error("Failed to update roster name format");
    }
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "class",
      resourceId: ctx.classDoc._id,
      summary: "Updated how roster names are displayed",
      summaryKey: "activitySummary_setRosterNameFormat",
      metadata: {
        rosterNameOrder: args.rosterNameOrder,
        rosterNameSpace: String(args.rosterNameSpace),
      },
    });
    return withClassDefaults(updated);
  },
});

/** Lookback windows for warning and minus badges on the points board. */
export const setPointsBadgeWindows = classMutation({
  args: {
    warningWindowAmount: v.number(),
    warningWindowUnit: pointsBadgeWindowUnitValidator,
    minusWindowAmount: v.number(),
    minusWindowUnit: pointsBadgeWindowUnitValidator,
  },
  returns: classValidator,
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "classUpdate", { key: ctx.userId, throws: true });
    await ctx.require("class:update");
    const warning = normalizePointsBadgeWindow(args.warningWindowAmount, args.warningWindowUnit);
    const minus = normalizePointsBadgeWindow(args.minusWindowAmount, args.minusWindowUnit);
    await ctx.db.patch("classes", ctx.classDoc._id, {
      warningWindowAmount: warning.amount,
      warningWindowUnit: warning.unit,
      minusWindowAmount: minus.amount,
      minusWindowUnit: minus.unit,
      updatedAt: Date.now(),
    });
    const updated = await ctx.db.get("classes", ctx.classDoc._id);
    if (!updated) {
      throw new Error("Failed to update points badge windows");
    }
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "class",
      resourceId: ctx.classDoc._id,
      summary: "Updated points badge lookback windows",
      summaryKey: "activitySummary_setPointsBadgeWindows",
      metadata: {
        warningWindowAmount: String(warning.amount),
        warningWindowUnit: warning.unit,
        minusWindowAmount: String(minus.amount),
        minusWindowUnit: minus.unit,
      },
    });
    return withClassDefaults(updated);
  },
});

/** Enable or disable the unauthenticated public points display page. */
export const setPointsPublicDisplay = classMutation({
  args: {
    enabled: v.boolean(),
  },
  returns: classValidator,
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "classUpdate", { key: ctx.userId, throws: true });
    await ctx.require("class:update");

    let pointsPublicSlug = ctx.classDoc.pointsPublicSlug;
    if (args.enabled && pointsPublicSlug === undefined) {
      pointsPublicSlug = await generateUniquePointsPublicSlug(ctx);
    }

    await ctx.db.patch("classes", ctx.classDoc._id, {
      pointsPublicEnabled: args.enabled,
      ...(pointsPublicSlug !== undefined ? { pointsPublicSlug } : {}),
      updatedAt: Date.now(),
    });
    const updated = await ctx.db.get("classes", ctx.classDoc._id);
    if (!updated) {
      throw new Error("Failed to update public points display");
    }
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "class",
      resourceId: ctx.classDoc._id,
      summary: args.enabled
        ? `Enabled public points display for "${ctx.classDoc.name}"`
        : `Disabled public points display for "${ctx.classDoc.name}"`,
      summaryKey: args.enabled
        ? "activitySummary_enabledPointsPublicDisplay"
        : "activitySummary_disabledPointsPublicDisplay",
      metadata: { name: ctx.classDoc.name, enabled: String(args.enabled) },
    });
    return withClassDefaults(updated);
  },
});

export const clearBanner = classMutation({
  args: {},
  returns: classValidator,
  handler: async (ctx) => {
    await rateLimiter.limit(ctx, "classUpdate", { key: ctx.userId, throws: true });
    await ctx.require("class:update");
    await ctx.db.patch("classes", ctx.classDoc._id, {
      bannerFileId: undefined,
      updatedAt: Date.now(),
    });
    const updated = await ctx.db.get("classes", ctx.classDoc._id);
    if (!updated) {
      throw new Error("Failed to clear class banner");
    }
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "class",
      resourceId: ctx.classDoc._id,
      summary: `Cleared dashboard banner for "${ctx.classDoc.name}"`,
      summaryKey: "activitySummary_clearedDashboardBanner",
      metadata: { name: ctx.classDoc.name },
    });
    return withClassDefaults(updated);
  },
});

export const remove = classMutation({
  args: {
    confirmation: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "classDelete", { key: ctx.userId, throws: true });
    await ctx.require("class:delete");
    const expected = deleteConfirmationPhrase(ctx.classDoc.name);
    if (args.confirmation !== expected) {
      throw new Error(`Type "${expected}" to confirm deletion`);
    }
    const classId = ctx.classDoc._id;
    await revokeAllClassMembership(ctx, classId);
    await deleteJoinCodesForClass(ctx, classId);
    await clearLinksForClass(ctx, classId);
    await deleteGroupsForClass(ctx, classId);
    await deleteAttendanceForClass(ctx, classId);
    await deleteStudentRostersForClass(ctx, classId);
    await deleteClassUserSettingsForClass(ctx, classId);
    await deleteAnnouncementsForClass(ctx, classId);
    await deleteTasksForClass(ctx, classId);
    await deleteAssignmentsForClass(ctx, classId);
    await deleteExpectationsForClass(ctx, classId);
    await deleteGradedSubjectsForClass(ctx, classId);
    await deleteRandomAssignersForClass(ctx, classId);
    await deleteGradeScalesForClass(ctx, classId);
    await deleteBehaviorsForClass(ctx, classId);
    await deleteRewardsForClass(ctx, classId);
    await deleteWarningEventsForClass(ctx, classId);
    await deleteFilesForClass(ctx, classId);
    // Purge activity without keeping a delete row (class is gone).
    await ctx.scheduler.runAfter(0, internal.activity.purgeForClass, { classId });
    await ctx.db.delete("classes", classId);
    return null;
  },
});

const eligibleOwnerValidator = v.object({
  userId: v.id("users"),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  image: v.optional(v.string()),
  role: v.union(v.literal("teacher"), v.literal("assistant_teacher")),
});

/**
 * Teachers and assistant teachers who can receive ownership (non-suspended).
 */
export const eligibleOwners = classQuery({
  args: {},
  returns: v.array(eligibleOwnerValidator),
  handler: async (ctx) => {
    await ctx.require("class:delete");

    const byUserId = new Map<string, "teacher" | "assistant_teacher">();
    for (const role of ["teacher", "assistant_teacher"] as const) {
      const users = await ctx.runQuery(components.authz.queries.getUsersWithRole, {
        tenantId: APP_CONFIG.authzTenantId,
        role,
        scope: ctx.scope,
      });
      for (const entry of users) {
        if (entry.userId === ctx.userId) continue;
        const existing = byUserId.get(entry.userId);
        if (!existing || role === "teacher") {
          byUserId.set(entry.userId, role);
        }
      }
    }

    const results: Array<{
      userId: Id<"users">;
      name?: string;
      email?: string;
      image?: string;
      role: "teacher" | "assistant_teacher";
    }> = [];

    for (const [userId, role] of byUserId) {
      const canAct = await authz.can(ctx, userId, "class:read", ctx.scope);
      if (!canAct) continue;
      const user = await ctx.db.get("users", userId as Id<"users">);
      if (!user) continue;
      results.push({
        userId: user._id,
        name: user.name,
        email: user.email,
        image: await resolveUserImageUrl(ctx, user),
        role,
      });
    }

    results.sort((a, b) => {
      const nameA = (a.name ?? a.email ?? a.userId).toLocaleLowerCase();
      const nameB = (b.name ?? b.email ?? b.userId).toLocaleLowerCase();
      return nameA.localeCompare(nameB);
    });

    return results;
  },
});

/**
 * Transfer class ownership to a teacher or assistant_teacher.
 * Unentitled exit path so expired-trial owners can still satisfy GDPR deletion.
 */
export const transferOwnership = classMutation({
  args: {
    toUserId: v.id("users"),
  },
  returns: classValidator,
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "classTransferOwnership", { key: ctx.userId, throws: true });
    await ctx.require("class:delete");

    if (args.toUserId === ctx.userId) {
      throw new Error("You already own this class");
    }

    if (ctx.classDoc.ownerId !== ctx.userId) {
      throw new Error("Only the current owner can transfer ownership");
    }

    const targetRoles = await authz.getUserRoles(ctx, args.toUserId, ctx.scope);
    const role = pickHighestClassRole(
      targetRoles.map((entry: { role: string }) => entry.role).filter(isClassRole),
    );
    if (role !== "teacher" && role !== "assistant_teacher") {
      throw new Error("Recipient must be a teacher or assistant teacher in this class");
    }

    const canAct = await authz.can(ctx, args.toUserId, "class:read", ctx.scope);
    if (!canAct) {
      throw new Error("Recipient is suspended and cannot receive ownership");
    }

    await authz.assignRole(ctx, args.toUserId, "owner", ctx.scope);
    // Drop the recipient's previous membership role so they are owner only.
    await authz.revokeRole(ctx, args.toUserId, role, ctx.scope);
    await authz.revokeRole(ctx, ctx.userId, "owner", ctx.scope);
    // Outgoing owner is demoted to teacher (not removed from the class).
    await authz.assignRole(ctx, ctx.userId, "teacher", ctx.scope);
    // Role swaps should not leave stale grant/deny overrides from prior roles.
    await clearClassPermissionOverrides(ctx, ctx.classDoc._id, args.toUserId);
    await clearClassPermissionOverrides(ctx, ctx.classDoc._id, ctx.userId);

    await ctx.db.patch("classes", ctx.classDoc._id, {
      ownerId: args.toUserId,
      updatedAt: Date.now(),
    });

    const updated = await ctx.db.get("classes", ctx.classDoc._id);
    if (!updated) {
      throw new Error("Failed to transfer ownership");
    }
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "class",
      resourceId: ctx.classDoc._id,
      summary: `Transferred ownership of "${ctx.classDoc.name}"`,
      summaryKey: "activitySummary_transferredOwnership",
      metadata: { name: ctx.classDoc.name, toUserId: args.toUserId },
    });
    return withClassDefaults(updated);
  },
});
