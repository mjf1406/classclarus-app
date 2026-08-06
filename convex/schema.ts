import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { languageValidator } from "./lib/languages.js";
import { v } from "convex/values";

const schema = defineSchema({
  ...authTables,
  /**
   * Extends Convex Auth `users` with an optional self-host/Electron avatar
   * file. Display URLs are resolved at query time from this id (see
   * `resolveUserImageUrl`); OAuth provider URLs remain in `image`.
   */
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    /** Personal `files` row used as the profile photo (self-host / Electron). */
    avatarFileId: v.optional(v.id("files")),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),
  userSettings: defineTable({
    userId: v.id("users"),
    language: languageValidator,
  }).index("by_userId", ["userId"]),
  classes: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    year: v.number(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    /** Class-scoped image file shown on the dashboard. */
    bannerFileId: v.optional(v.id("files")),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
  }).index("by_owner", ["ownerId"]),
  joinCodes: defineTable({
    code: v.string(),
    classId: v.id("classes"),
    createdBy: v.id("users"),
    role: v.union(
      v.literal("teacher"),
      v.literal("assistant_teacher"),
      v.literal("student"),
      v.literal("guardian"),
    ),
    expiresAt: v.number(),
    maxUses: v.number(),
    useCount: v.number(),
    expirationJobId: v.optional(v.id("_scheduled_functions")),
  })
    .index("by_code", ["code"])
    .index("by_class", ["classId"])
    .index("by_creator", ["createdBy"]),
  /**
   * One card-less trial grant per normalized email.
   * Survives account delete/recreate — never re-grant for the same emailKey.
   */
  trialGrants: defineTable({
    emailKey: v.string(),
    /** Cleared on account deletion; reattached on re-signup via emailKey. */
    userId: v.optional(v.id("users")),
    startedAt: v.number(),
    endsAt: v.number(),
    /** Set by the scheduled `markExpired` job when the trial lapses. */
    expiredAt: v.optional(v.number()),
    expirationJobId: v.optional(v.id("_scheduled_functions")),
  })
    .index("by_emailKey", ["emailKey"])
    .index("by_userId", ["userId"])
    .index("by_endsAt", ["endsAt"]),
  /**
   * Ownership registry for Convex storage blobs.
   * Only finalized uploads (validated MIME/size) get a row.
   * Optional `classId` places the file in a class library (`files:read` for members;
   * `files:create` for owner/teacher; uploader retains update/delete).
   * Absent `classId` = personal / owner-only.
   */
  files: defineTable({
    storageId: v.id("_storage"),
    userId: v.id("users"),
    classId: v.optional(v.id("classes")),
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
    preset: v.string(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_storageId", ["storageId"])
    .index("by_classId", ["classId"]),
  /**
   * Many-to-many guardian ↔ student links within a class.
   * Cleared when either side leaves the guardian/student role.
   */
  guardianStudentLinks: defineTable({
    classId: v.id("classes"),
    guardianUserId: v.id("users"),
    studentUserId: v.id("users"),
    createdAt: v.number(),
    createdBy: v.id("users"),
  })
    .index("by_class_guardian", ["classId", "guardianUserId"])
    .index("by_class_student", ["classId", "studentUserId"])
    .index("by_class_guardian_student", ["classId", "guardianUserId", "studentUserId"]),
  /**
   * Anonymous Free-card CTA clicks (cloud prod only). No user/IP fields.
   * Aggregated via @convex-dev/aggregate for range counts.
   */
  anonymousUsageEvents: defineTable({
    kind: v.union(v.literal("desktop_download"), v.literal("self_host_click")),
    os: v.optional(v.union(v.literal("windows"), v.literal("mac"), v.literal("ubuntu"))),
  }),
  /**
   * Daily GitHub Traffic clone counts (CI-adjusted). Synced by cron.
   */
  githubCloneDays: defineTable({
    dayKey: v.string(),
    dayStartMs: v.number(),
    rawCount: v.number(),
    ciSubtracted: v.number(),
    count: v.number(),
    uniques: v.number(),
    syncedAt: v.number(),
  }).index("by_dayKey", ["dayKey"]),
  /**
   * Cloud product feedback (message-in-a-bottle). Not used on self-host / Electron.
   */
  feedback: defineTable({
    userId: v.id("users"),
    type: v.union(v.literal("bug"), v.literal("feature"), v.literal("concern"), v.literal("other")),
    title: v.string(),
    body: v.string(),
    stepsToReproduce: v.optional(v.string()),
    expected: v.optional(v.string()),
    actual: v.optional(v.string()),
    severity: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    useCase: v.optional(v.string()),
    proposedSolution: v.optional(v.string()),
    importance: v.optional(
      v.union(v.literal("nice"), v.literal("important"), v.literal("critical")),
    ),
    impact: v.optional(v.string()),
    wantReply: v.boolean(),
    attachmentFileIds: v.array(v.id("files")),
    createdAt: v.number(),
    archivedAt: v.optional(v.number()),
    /** Demo / seed rows — deletable via clearDemo. */
    isSeed: v.optional(v.boolean()),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_userId", ["userId"])
    .index("by_isSeed", ["isSeed"]),
});

export default schema;
