import type { Doc, Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { internalMutation } from "./_generated/server.js";
import {
  JOIN_CODE_INVITE_PERMISSION_BY_ROLE,
  classScope,
  isClassRole,
  isJoinCodeRole,
  pickHighestClassRole,
  type JoinCodeRole,
} from "./lib/authzModel.js";
import { recordClassActivity } from "./lib/classActivity.js";
import {
  countGuardiansForStudent,
  getClassRoleForUser,
  linkGuardianToStudent,
  MAX_GUARDIANS_PER_STUDENT,
} from "./lib/guardianLinks.js";
import { deleteJoinCodeById } from "./lib/joinCodesCleanup.js";
import { authedMutation, classMutation, classQuery } from "./lib/customFunctions.js";
import { rateLimiter } from "./lib/rateLimiter.js";
import { formatRosterNameParts, resolveRosterNameFormat } from "./lib/rosterNameFormat.js";
import { ensureStudentRosterRow } from "./lib/studentRosters.js";
import { authz } from "./authz.js";
import { internal } from "./_generated/api.js";
import { ConvexError, v } from "convex/values";

const CODE_LENGTH = 6;
const MAX_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const GUARDIAN_INVITE_MAX_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_USES = 1;
const MAX_USES = 100;
const MAX_GUARDIAN_INVITE_STUDENTS = 200;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_GENERATE_ATTEMPTS = 12;

const joinCodeRoleValidator = v.union(
  v.literal("teacher"),
  v.literal("assistant_teacher"),
  v.literal("student"),
  v.literal("guardian"),
);

const joinCodeValidator = v.object({
  _id: v.id("joinCodes"),
  _creationTime: v.number(),
  code: v.string(),
  classId: v.id("classes"),
  createdBy: v.id("users"),
  role: joinCodeRoleValidator,
  expiresAt: v.number(),
  maxUses: v.number(),
  useCount: v.number(),
  studentUserId: v.optional(v.id("users")),
  studentDisplayName: v.optional(v.string()),
});

const createdGuardianInviteValidator = v.object({
  _id: v.id("joinCodes"),
  code: v.string(),
  studentUserId: v.id("users"),
  studentDisplayName: v.optional(v.string()),
  expiresAt: v.number(),
  maxUses: v.number(),
});

function normalizeJoinCode(code: string): string {
  const normalized = code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (normalized.length !== CODE_LENGTH) {
    throw new Error("Invite code must be 6 characters");
  }
  return normalized;
}

function normalizeMaxUses(maxUses: number): number {
  if (!Number.isInteger(maxUses) || maxUses < MIN_USES || maxUses > MAX_USES) {
    throw new Error(`Uses must be an integer between ${MIN_USES} and ${MAX_USES}`);
  }
  return maxUses;
}

function normalizeTtlMs(ttlMs: number): number {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > MAX_TTL_MS) {
    throw new Error("Expiry must be between 1 second and 3 days");
  }
  return ttlMs;
}

function normalizeGuardianTtlMs(ttlMs: number): number {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > GUARDIAN_INVITE_MAX_TTL_MS) {
    throw new Error("Expiry must be between 1 second and 7 days");
  }
  return ttlMs;
}

async function resolveStudentDisplayName(
  ctx: QueryCtx | MutationCtx,
  classDoc: Doc<"classes">,
  studentUserId: Id<"users">,
): Promise<string | undefined> {
  const roster = await ctx.db
    .query("studentRosters")
    .withIndex("by_classId_userId", (q) =>
      q.eq("classId", classDoc._id).eq("userId", studentUserId),
    )
    .unique();
  const format = resolveRosterNameFormat({
    rosterNameOrder: classDoc.rosterNameOrder,
    rosterNameSpace: classDoc.rosterNameSpace,
  });
  const rosterName = formatRosterNameParts(roster?.firstName, roster?.lastName, format);
  if (rosterName) return rosterName;
  const user = await ctx.db.get("users", studentUserId);
  return user?.name ?? user?.email ?? undefined;
}

function randomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let result = "";
  for (const byte of bytes) {
    result += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return result;
}

async function generateUniqueCode(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < CODE_GENERATE_ATTEMPTS; attempt += 1) {
    const code = randomCode();
    const existing = await ctx.db
      .query("joinCodes")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!existing) {
      return code;
    }
  }
  throw new Error("Could not generate a unique invite code");
}

function toPublicJoinCode(doc: Doc<"joinCodes">, studentDisplayName?: string) {
  return {
    _id: doc._id,
    _creationTime: doc._creationTime,
    code: doc.code,
    classId: doc.classId,
    createdBy: doc.createdBy,
    role: doc.role,
    expiresAt: doc.expiresAt,
    maxUses: doc.maxUses,
    useCount: doc.useCount,
    ...(doc.studentUserId !== undefined ? { studentUserId: doc.studentUserId } : {}),
    ...(studentDisplayName !== undefined ? { studentDisplayName } : {}),
  };
}

export const listForClass = classQuery({
  args: {},
  returns: v.array(joinCodeValidator),
  handler: async (ctx) => {
    await ctx.require("invitations:read");
    // Live codes per class are intentionally bounded (short TTL + finite uses).
    // Expiry is filtered client-side so the query args stay stable (no ticking `now`).
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- bounded invitation list for one class
    const codes = await ctx.db
      .query("joinCodes")
      .withIndex("by_class", (q) => q.eq("classId", ctx.classDoc._id))
      .collect();
    const live = codes
      .filter((code) => code.useCount < code.maxUses)
      .sort((a, b) => b._creationTime - a._creationTime);
    const result = [];
    for (const code of live) {
      const studentDisplayName = code.studentUserId
        ? await resolveStudentDisplayName(ctx, ctx.classDoc, code.studentUserId)
        : undefined;
      result.push(toPublicJoinCode(code, studentDisplayName));
    }
    return result;
  },
});

export const create = classMutation({
  args: {
    role: joinCodeRoleValidator,
    ttlMs: v.number(),
    maxUses: v.number(),
  },
  returns: joinCodeValidator,
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "joinCodeCreate", { key: ctx.userId, throws: true });
    await ctx.require("invitations:create");

    if (ctx.classDoc.archivedAt !== undefined) {
      throw new Error("Cannot create invite codes for an archived class");
    }

    if (!isJoinCodeRole(args.role)) {
      throw new Error("Invalid invite role");
    }
    await ctx.require(JOIN_CODE_INVITE_PERMISSION_BY_ROLE[args.role]);

    const ttlMs = normalizeTtlMs(args.ttlMs);
    const maxUses = normalizeMaxUses(args.maxUses);
    const now = Date.now();
    const expiresAt = now + ttlMs;
    const code = await generateUniqueCode(ctx);

    const joinCodeId = await ctx.db.insert("joinCodes", {
      code,
      classId: ctx.classDoc._id,
      createdBy: ctx.userId,
      role: args.role,
      expiresAt,
      maxUses,
      useCount: 0,
    });

    const expirationJobId = await ctx.scheduler.runAt(expiresAt, internal.joinCodes.deleteExpired, {
      joinCodeId,
    });
    await ctx.db.patch("joinCodes", joinCodeId, { expirationJobId });

    const created = await ctx.db.get("joinCodes", joinCodeId);
    if (!created) {
      throw new Error("Failed to create invite code");
    }
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "joinCode",
      resourceId: joinCodeId,
      summary: `Created invite code for role ${args.role}`,
      summaryKey: "activitySummary_createdInviteCode",
      metadata: { role: args.role, maxUses: String(maxUses) },
    });
    return toPublicJoinCode(created);
  },
});

export const createGuardianInvites = classMutation({
  args: {
    studentUserIds: v.array(v.id("users")),
    ttlMs: v.number(),
    maxUses: v.number(),
  },
  returns: v.array(createdGuardianInviteValidator),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "guardianInviteCreate", { key: ctx.userId, throws: true });
    await ctx.require("invitations:create");
    await ctx.require("guardians:invite");

    if (ctx.classDoc.archivedAt !== undefined) {
      throw new Error("Cannot create invite codes for an archived class");
    }

    const uniqueStudentIds = [...new Set(args.studentUserIds)];
    if (uniqueStudentIds.length === 0) {
      throw new Error("No active students to create codes for");
    }
    if (uniqueStudentIds.length > MAX_GUARDIAN_INVITE_STUDENTS) {
      throw new Error(`Cannot create codes for more than ${MAX_GUARDIAN_INVITE_STUDENTS} students`);
    }

    for (const studentUserId of uniqueStudentIds) {
      const role = await getClassRoleForUser(ctx, studentUserId, ctx.scope);
      if (role !== "student") {
        throw new Error("Each invite must be for a current student in this class");
      }
    }

    const ttlMs = normalizeGuardianTtlMs(args.ttlMs);
    const maxUses = normalizeMaxUses(args.maxUses);
    const now = Date.now();
    const expiresAt = now + ttlMs;
    const created = [];

    for (const studentUserId of uniqueStudentIds) {
      const code = await generateUniqueCode(ctx);
      const joinCodeId = await ctx.db.insert("joinCodes", {
        code,
        classId: ctx.classDoc._id,
        createdBy: ctx.userId,
        role: "guardian",
        expiresAt,
        maxUses,
        useCount: 0,
        studentUserId,
      });
      const expirationJobId = await ctx.scheduler.runAt(
        expiresAt,
        internal.joinCodes.deleteExpired,
        { joinCodeId },
      );
      await ctx.db.patch("joinCodes", joinCodeId, { expirationJobId });
      const studentDisplayName = await resolveStudentDisplayName(ctx, ctx.classDoc, studentUserId);
      created.push({
        _id: joinCodeId,
        code,
        studentUserId,
        ...(studentDisplayName !== undefined ? { studentDisplayName } : {}),
        expiresAt,
        maxUses,
      });
    }

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "joinCode",
      resourceId: created[0]!._id,
      summary: `Created ${created.length} guardian invite codes`,
      summaryKey: "activitySummary_createdGuardianInvites",
      metadata: { count: String(created.length) },
    });

    return created;
  },
});

export const revoke = classMutation({
  args: {
    joinCodeId: v.id("joinCodes"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "joinCodeRevoke", { key: ctx.userId, throws: true });
    await ctx.require("invitations:revoke");
    const codeDoc = await ctx.db.get("joinCodes", args.joinCodeId);
    if (!codeDoc || codeDoc.classId !== ctx.classDoc._id) {
      throw new Error("Invite code not found");
    }
    await deleteJoinCodeById(ctx, codeDoc._id);
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "joinCode",
      resourceId: args.joinCodeId,
      summary: `Revoked invite code for role ${codeDoc.role}`,
      summaryKey: "activitySummary_revokedInviteCode",
      metadata: { role: codeDoc.role },
    });
    return null;
  },
});

export const redeem = authedMutation({
  args: {
    code: v.string(),
  },
  returns: v.object({
    classId: v.id("classes"),
    role: joinCodeRoleValidator,
  }),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "joinCodeRedeemGlobal", { throws: true });
    await rateLimiter.limit(ctx, "joinCodeRedeemShort", { key: ctx.userId, throws: true });
    await rateLimiter.limit(ctx, "joinCodeRedeemHourly", { key: ctx.userId, throws: true });

    const rejectInvalid = async (): Promise<never> => {
      await rateLimiter.limit(ctx, "joinCodeRedeemFailure", { key: ctx.userId, throws: true });
      throw new ConvexError({
        code: "INVALID_JOIN_CODE",
        message: "Invalid or expired invite code",
      });
    };

    const code = normalizeJoinCode(args.code);
    const codeDoc = await ctx.db
      .query("joinCodes")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();

    if (!codeDoc) {
      return await rejectInvalid();
    }

    const now = Date.now();
    if (codeDoc.expiresAt <= now) {
      await deleteJoinCodeById(ctx, codeDoc._id);
      return await rejectInvalid();
    }

    if (codeDoc.useCount >= codeDoc.maxUses) {
      await deleteJoinCodeById(ctx, codeDoc._id);
      return await rejectInvalid();
    }

    const classDoc = await ctx.db.get("classes", codeDoc.classId);
    if (!classDoc) {
      await deleteJoinCodeById(ctx, codeDoc._id);
      return await rejectInvalid();
    }

    if (classDoc.archivedAt !== undefined) {
      throw new ConvexError({
        code: "CLASS_ARCHIVED",
        message: "This class is archived and cannot be joined",
      });
    }

    const scope = classScope(codeDoc.classId);
    const existingRoles = await authz.getUserRoles(ctx, ctx.userId, scope);
    const existingRole = pickHighestClassRole(
      existingRoles.map((entry: { role: string }) => entry.role).filter(isClassRole),
    );

    const studentUserId = codeDoc.studentUserId;
    const isGuardianStudentInvite = studentUserId !== undefined && codeDoc.role === "guardian";

    if (existingRole && !(isGuardianStudentInvite && existingRole === "guardian")) {
      throw new ConvexError({
        code: "ALREADY_MEMBER",
        message: "You are already a member of this class",
      });
    }

    if (isGuardianStudentInvite) {
      const studentRole = await getClassRoleForUser(ctx, studentUserId, scope);
      if (studentRole !== "student") {
        return await rejectInvalid();
      }
      const existingLink = await ctx.db
        .query("guardianStudentLinks")
        .withIndex("by_class_guardian_student", (q) =>
          q
            .eq("classId", codeDoc.classId)
            .eq("guardianUserId", ctx.userId)
            .eq("studentUserId", studentUserId),
        )
        .unique();
      if (existingLink) {
        throw new ConvexError({
          code: "ALREADY_LINKED",
          message: "You are already linked to this student",
        });
      }
      const guardianCount = await countGuardiansForStudent(ctx, codeDoc.classId, studentUserId);
      if (guardianCount >= MAX_GUARDIANS_PER_STUDENT) {
        throw new ConvexError({
          code: "GUARDIAN_LIMIT_REACHED",
          message: "This student already has the maximum number of guardians",
        });
      }
    }

    const role: JoinCodeRole = codeDoc.role;
    const joinedAsNewMember = existingRole === null;
    if (joinedAsNewMember) {
      await authz.assignRole(ctx, ctx.userId, role, scope);
      if (role === "student") {
        await ensureStudentRosterRow(ctx, codeDoc.classId, ctx.userId);
      }
    }

    if (isGuardianStudentInvite) {
      const linkResult = await linkGuardianToStudent(ctx, {
        classId: codeDoc.classId,
        guardianUserId: ctx.userId,
        studentUserId,
        createdBy: ctx.userId,
      });
      if (linkResult === "existing") {
        throw new ConvexError({
          code: "ALREADY_LINKED",
          message: "You are already linked to this student",
        });
      }
    }

    const nextUseCount = codeDoc.useCount + 1;
    if (nextUseCount >= codeDoc.maxUses) {
      await deleteJoinCodeById(ctx, codeDoc._id);
    } else {
      await ctx.db.patch("joinCodes", codeDoc._id, { useCount: nextUseCount });
    }

    if (joinedAsNewMember) {
      await recordClassActivity(ctx, {
        classId: codeDoc.classId,
        actorUserId: ctx.userId,
        action: "write",
        resourceType: "member",
        resourceId: ctx.userId,
        summary: `Joined class as ${role}`,
        summaryKey: "activitySummary_joinedClass",
        metadata: { role, via: "joinCode" },
      });
    }

    if (isGuardianStudentInvite) {
      await recordClassActivity(ctx, {
        classId: codeDoc.classId,
        actorUserId: ctx.userId,
        action: "write",
        resourceType: "guardianLink",
        resourceId: ctx.userId,
        summary: "Linked guardian to student via invite",
        summaryKey: "activitySummary_linkedGuardianViaInvite",
        metadata: { studentUserId },
      });
    }

    return { classId: codeDoc.classId, role };
  },
});

export const deleteExpired = internalMutation({
  args: {
    joinCodeId: v.id("joinCodes"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const codeDoc = await ctx.db.get("joinCodes", args.joinCodeId);
    if (!codeDoc) {
      return null;
    }
    // Only delete if expired or exhausted; revoke already removed the row.
    if (codeDoc.expiresAt > Date.now() && codeDoc.useCount < codeDoc.maxUses) {
      return null;
    }
    await ctx.db.delete("joinCodes", codeDoc._id);
    return null;
  },
});
