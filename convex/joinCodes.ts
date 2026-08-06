import type { Doc } from "./_generated/dataModel.js";
import type { MutationCtx } from "./_generated/server.js";
import { internalMutation } from "./_generated/server.js";
import {
  JOIN_CODE_INVITE_PERMISSION_BY_ROLE,
  classScope,
  isClassRole,
  isJoinCodeRole,
  pickHighestClassRole,
  type JoinCodeRole,
} from "./lib/authzModel.js";
import { deleteJoinCodeById } from "./lib/joinCodesCleanup.js";
import { authedMutation, classMutation, classQuery } from "./lib/customFunctions.js";
import { rateLimiter } from "./lib/rateLimiter.js";
import { authz } from "./authz.js";
import { internal } from "./_generated/api.js";
import { ConvexError, v } from "convex/values";

const CODE_LENGTH = 6;
const MAX_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_USES = 1;
const MAX_USES = 100;
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
    throw new Error("Expiry must be between 1 second and 24 hours");
  }
  return ttlMs;
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

function toPublicJoinCode(doc: Doc<"joinCodes">) {
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
  };
}

export const listForClass = classQuery({
  args: {
    now: v.number(),
  },
  returns: v.array(joinCodeValidator),
  handler: async (ctx, args) => {
    await ctx.require("invitations:read");
    // Live codes per class are intentionally bounded (short TTL + finite uses).
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- bounded invitation list for one class
    const codes = await ctx.db
      .query("joinCodes")
      .withIndex("by_class", (q) => q.eq("classId", ctx.classDoc._id))
      .collect();
    return codes
      .filter((code) => code.expiresAt > args.now && code.useCount < code.maxUses)
      .map(toPublicJoinCode)
      .sort((a, b) => b._creationTime - a._creationTime);
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
    return toPublicJoinCode(created);
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
    if (existingRole) {
      throw new ConvexError({
        code: "ALREADY_MEMBER",
        message: "You are already a member of this class",
      });
    }

    const role: JoinCodeRole = codeDoc.role;
    await authz.assignRole(ctx, ctx.userId, role, scope);

    const nextUseCount = codeDoc.useCount + 1;
    if (nextUseCount >= codeDoc.maxUses) {
      await deleteJoinCodeById(ctx, codeDoc._id);
    } else {
      await ctx.db.patch("joinCodes", codeDoc._id, { useCount: nextUseCount });
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
