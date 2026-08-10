import { v } from "convex/values";

import type { Id } from "./_generated/dataModel.js";
import type { MutationCtx } from "./_generated/server.js";
import { recordClassActivity } from "./lib/classActivity.js";
import { classScope } from "./lib/authzModel.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import { getClassRoleForUser } from "./lib/guardianLinks.js";
import { rateLimiter } from "./lib/rateLimiter.js";

const MAX_ZONE_NAME_LENGTH = 80;

const constraintTypeValidator = v.union(
  v.literal("neighbor"),
  v.literal("teammate"),
  v.literal("zone"),
);

const polarityValidator = v.union(v.literal("must"), v.literal("mustNot"));

const seatConstraintValidator = v.object({
  _id: v.id("seatConstraints"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  type: constraintTypeValidator,
  polarity: polarityValidator,
  studentUserId: v.id("users"),
  otherStudentUserId: v.optional(v.id("users")),
  zoneName: v.optional(v.string()),
  updatedAt: v.number(),
  createdBy: v.id("users"),
});

type ConstraintType = "neighbor" | "teammate" | "zone";
type Polarity = "must" | "mustNot";

async function requireStudentInClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
  studentUserId: Id<"users">,
): Promise<void> {
  const role = await getClassRoleForUser(ctx, studentUserId, classScope(classId));
  if (role !== "student") {
    throw new Error("Person must be a student in this class");
  }
}

function normalizeZoneName(zoneName: string): string {
  const trimmed = zoneName.trim();
  if (!trimmed) {
    throw new Error("Zone is required");
  }
  if (trimmed.length > MAX_ZONE_NAME_LENGTH) {
    throw new Error(`Zone name must be at most ${MAX_ZONE_NAME_LENGTH} characters`);
  }
  return trimmed;
}

async function classHasZoneName(
  ctx: MutationCtx,
  classId: Id<"classes">,
  zoneName: string,
): Promise<boolean> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class-bounded layout list
  const layouts = await ctx.db
    .query("seatLayouts")
    .withIndex("by_class", (q) => q.eq("classId", classId))
    .collect();

  for (const layout of layouts) {
    for (const item of layout.items) {
      if (item.kind !== "desk") continue;
      if (item.zoneName?.trim() === zoneName) return true;
    }
  }
  return false;
}

async function normalizeConstraintFields(
  ctx: MutationCtx,
  classId: Id<"classes">,
  args: {
    type: ConstraintType;
    polarity: Polarity;
    studentUserId: Id<"users">;
    otherStudentUserId?: Id<"users">;
    zoneName?: string;
  },
): Promise<{
  type: ConstraintType;
  polarity: Polarity;
  studentUserId: Id<"users">;
  otherStudentUserId?: Id<"users">;
  zoneName?: string;
}> {
  await requireStudentInClass(ctx, classId, args.studentUserId);

  if (args.type === "zone") {
    if (args.otherStudentUserId !== undefined) {
      throw new Error("Zone constraints cannot include a second student");
    }
    if (args.zoneName === undefined) {
      throw new Error("Zone is required");
    }
    const zoneName = normalizeZoneName(args.zoneName);
    const exists = await classHasZoneName(ctx, classId, zoneName);
    if (!exists) {
      throw new Error("Zone not found on any seat layout in this class");
    }
    return {
      type: args.type,
      polarity: args.polarity,
      studentUserId: args.studentUserId,
      zoneName,
    };
  }

  if (args.zoneName !== undefined) {
    throw new Error("Neighbor and teammate constraints cannot include a zone");
  }
  if (args.otherStudentUserId === undefined) {
    throw new Error("Select a second student");
  }
  if (args.otherStudentUserId === args.studentUserId) {
    throw new Error("Choose two different students");
  }
  await requireStudentInClass(ctx, classId, args.otherStudentUserId);

  return {
    type: args.type,
    polarity: args.polarity,
    studentUserId: args.studentUserId,
    otherStudentUserId: args.otherStudentUserId,
  };
}

function activityMetadata(fields: {
  type: ConstraintType;
  polarity: Polarity;
  zoneName?: string;
}): Record<string, string> {
  const metadata: Record<string, string> = {
    type: fields.type,
    polarity: fields.polarity,
  };
  if (fields.zoneName !== undefined) {
    metadata.zoneName = fields.zoneName;
  }
  return metadata;
}

/**
 * List seating constraints for a class (newest first).
 */
export const list = classQuery({
  args: {},
  returns: v.array(seatConstraintValidator),
  handler: async (ctx) => {
    await ctx.require("assigners:read");
    const classId = ctx.classDoc._id;
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- class-bounded constraint list
    const docs = await ctx.db
      .query("seatConstraints")
      .withIndex("by_class", (q) => q.eq("classId", classId))
      .collect();

    return docs
      .map((doc) => ({
        _id: doc._id,
        _creationTime: doc._creationTime,
        classId: doc.classId,
        type: doc.type,
        polarity: doc.polarity,
        studentUserId: doc.studentUserId,
        ...(doc.otherStudentUserId !== undefined
          ? { otherStudentUserId: doc.otherStudentUserId }
          : {}),
        ...(doc.zoneName !== undefined ? { zoneName: doc.zoneName } : {}),
        updatedAt: doc.updatedAt,
        createdBy: doc.createdBy,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt || b._creationTime - a._creationTime);
  },
});

/**
 * Create a class-scoped seating constraint.
 */
export const create = classMutation({
  args: {
    type: constraintTypeValidator,
    polarity: polarityValidator,
    studentUserId: v.id("users"),
    otherStudentUserId: v.optional(v.id("users")),
    zoneName: v.optional(v.string()),
  },
  returns: v.id("seatConstraints"),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "seatConstraintCreate", { key: ctx.userId, throws: true });
    await ctx.require("assigners:manage");

    const classId = ctx.classDoc._id;
    const fields = await normalizeConstraintFields(ctx, classId, args);
    const now = Date.now();

    const constraintId = await ctx.db.insert("seatConstraints", {
      classId,
      type: fields.type,
      polarity: fields.polarity,
      studentUserId: fields.studentUserId,
      ...(fields.otherStudentUserId !== undefined
        ? { otherStudentUserId: fields.otherStudentUserId }
        : {}),
      ...(fields.zoneName !== undefined ? { zoneName: fields.zoneName } : {}),
      createdBy: ctx.userId,
      updatedAt: now,
    });

    const metadata = activityMetadata(fields);
    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "seatConstraint",
      resourceId: constraintId,
      summary: `Created seat constraint (${fields.type}, ${fields.polarity})`,
      summaryKey: "activitySummary_createdSeatConstraint",
      metadata,
    });

    return constraintId;
  },
});

/**
 * Update a seating constraint.
 */
export const update = classMutation({
  args: {
    constraintId: v.id("seatConstraints"),
    type: constraintTypeValidator,
    polarity: polarityValidator,
    studentUserId: v.id("users"),
    otherStudentUserId: v.optional(v.id("users")),
    zoneName: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "seatConstraintUpdate", { key: ctx.userId, throws: true });
    await ctx.require("assigners:manage");

    const existing = await ctx.db.get("seatConstraints", args.constraintId);
    if (!existing || existing.classId !== ctx.classDoc._id) {
      throw new Error("Constraint not found");
    }

    const fields = await normalizeConstraintFields(ctx, ctx.classDoc._id, args);
    const now = Date.now();

    await ctx.db.replace("seatConstraints", args.constraintId, {
      classId: existing.classId,
      type: fields.type,
      polarity: fields.polarity,
      studentUserId: fields.studentUserId,
      ...(fields.otherStudentUserId !== undefined
        ? { otherStudentUserId: fields.otherStudentUserId }
        : {}),
      ...(fields.zoneName !== undefined ? { zoneName: fields.zoneName } : {}),
      createdBy: existing.createdBy,
      updatedAt: now,
    });

    const metadata = activityMetadata(fields);
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "seatConstraint",
      resourceId: args.constraintId,
      summary: `Updated seat constraint (${fields.type}, ${fields.polarity})`,
      summaryKey: "activitySummary_updatedSeatConstraint",
      metadata,
    });

    return null;
  },
});

/**
 * Delete a seating constraint.
 */
export const remove = classMutation({
  args: {
    constraintId: v.id("seatConstraints"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "seatConstraintRemove", { key: ctx.userId, throws: true });
    await ctx.require("assigners:manage");

    const existing = await ctx.db.get("seatConstraints", args.constraintId);
    if (!existing || existing.classId !== ctx.classDoc._id) {
      throw new Error("Constraint not found");
    }

    await ctx.db.delete("seatConstraints", args.constraintId);

    const metadata = activityMetadata({
      type: existing.type,
      polarity: existing.polarity,
      ...(existing.zoneName !== undefined ? { zoneName: existing.zoneName } : {}),
    });
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "seatConstraint",
      resourceId: args.constraintId,
      summary: `Deleted seat constraint (${existing.type}, ${existing.polarity})`,
      summaryKey: "activitySummary_deletedSeatConstraint",
      metadata,
    });

    return null;
  },
});
