import { ConvexError, v } from "convex/values";

import { APP_CONFIG } from "./appConfig.js";
import { components } from "./_generated/api.js";
import type { Doc, Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { classScope, type ClassPermission } from "./lib/authzModel.js";
import { recordClassActivity } from "./lib/classActivity.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import { resolvePersonalStudentIds } from "./lib/guardianLinks.js";
import { rateLimiter } from "./lib/rateLimiter.js";
import { resolveUserImageUrl } from "./lib/userImage.js";

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_UNIT_LENGTH = 40;
const MAX_ABS_VALUE = 1_000_000_000;

const inputTypeValidator = v.union(v.literal("number"), v.literal("numberRange"));

const expectationValidator = v.object({
  _id: v.id("expectations"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  name: v.string(),
  description: v.optional(v.string()),
  inputType: inputTypeValidator,
  unit: v.string(),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
  valueCount: v.number(),
});

const expectationValueValidator = v.object({
  _id: v.id("expectationValues"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  expectationId: v.id("expectations"),
  studentUserId: v.id("users"),
  numberValue: v.optional(v.number()),
  rangeMin: v.optional(v.number()),
  rangeMax: v.optional(v.number()),
  updatedAt: v.number(),
  updatedBy: v.id("users"),
});

const personalStudentValidator = v.object({
  userId: v.id("users"),
  rosterNumber: v.number(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  email: v.optional(v.string()),
});

type ClassAuthCtx = (QueryCtx | MutationCtx) & {
  userId: Id<"users">;
  can: (permission: ClassPermission) => Promise<boolean>;
  require: (permission: ClassPermission) => Promise<void>;
};

const bulkOperationValidator = v.union(
  v.literal("set"),
  v.literal("increaseBy"),
  v.literal("decreaseBy"),
  v.literal("increasePercent"),
  v.literal("decreasePercent"),
);

type BulkOperation = "set" | "increaseBy" | "decreaseBy" | "increasePercent" | "decreasePercent";

type NumberPayload = { kind: "number"; numberValue: number };
type RangePayload = { kind: "numberRange"; rangeMin: number; rangeMax: number };
type ValuePayload = NumberPayload | RangePayload;

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Name is required");
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new Error(`Name must be at most ${MAX_NAME_LENGTH} characters`);
  }
  return trimmed;
}

function normalizeOptionalDescription(description: string | undefined): string | undefined {
  if (description === undefined) return undefined;
  const trimmed = description.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
  }
  return trimmed;
}

function normalizeUnit(unit: string): string {
  const trimmed = unit.trim();
  if (!trimmed) {
    throw new Error("Unit is required");
  }
  if (trimmed.length > MAX_UNIT_LENGTH) {
    throw new Error(`Unit must be at most ${MAX_UNIT_LENGTH} characters`);
  }
  return trimmed;
}

function normalizeFiniteNumber(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  if (Math.abs(value) > MAX_ABS_VALUE) {
    throw new Error(`${label} is out of range`);
  }
  return value;
}

function normalizeNumberPayload(numberValue: number): NumberPayload {
  return { kind: "number", numberValue: normalizeFiniteNumber(numberValue, "Value") };
}

function normalizeRangePayload(rangeMin: number, rangeMax: number): RangePayload {
  const min = normalizeFiniteNumber(rangeMin, "Minimum");
  const max = normalizeFiniteNumber(rangeMax, "Maximum");
  if (min > max) {
    throw new Error("Minimum cannot be greater than maximum");
  }
  return { kind: "numberRange", rangeMin: min, rangeMax: max };
}

function payloadForExpectation(
  expectation: Doc<"expectations">,
  args: {
    numberValue?: number;
    rangeMin?: number;
    rangeMax?: number;
  },
): ValuePayload {
  if (expectation.inputType === "number") {
    if (args.numberValue === undefined) {
      throw new Error("Value is required");
    }
    return normalizeNumberPayload(args.numberValue);
  }
  if (args.rangeMin === undefined || args.rangeMax === undefined) {
    throw new Error("Range minimum and maximum are required");
  }
  return normalizeRangePayload(args.rangeMin, args.rangeMax);
}

function fieldsFromPayload(payload: ValuePayload): {
  numberValue?: number;
  rangeMin?: number;
  rangeMax?: number;
} {
  if (payload.kind === "number") {
    return {
      numberValue: payload.numberValue,
      rangeMin: undefined,
      rangeMax: undefined,
    };
  }
  return {
    numberValue: undefined,
    rangeMin: payload.rangeMin,
    rangeMax: payload.rangeMax,
  };
}

function readPayload(
  expectation: Doc<"expectations">,
  value: Doc<"expectationValues">,
): ValuePayload | null {
  if (expectation.inputType === "number") {
    if (value.numberValue === undefined) return null;
    return { kind: "number", numberValue: value.numberValue };
  }
  if (value.rangeMin === undefined || value.rangeMax === undefined) return null;
  return { kind: "numberRange", rangeMin: value.rangeMin, rangeMax: value.rangeMax };
}

function applyNumericOp(current: number, operation: BulkOperation, amount: number): number {
  switch (operation) {
    case "set":
      return amount;
    case "increaseBy":
      return current + amount;
    case "decreaseBy":
      return current - amount;
    case "increasePercent":
      return current * (1 + amount / 100);
    case "decreasePercent":
      return current * (1 - amount / 100);
  }
}

function applyBulkToPayload(
  expectation: Doc<"expectations">,
  existing: ValuePayload | null,
  operation: BulkOperation,
  args: { numberValue?: number; rangeMin?: number; rangeMax?: number },
): ValuePayload | null {
  if (operation === "set") {
    return payloadForExpectation(expectation, args);
  }

  if (!existing) {
    return null;
  }

  if (expectation.inputType === "number") {
    if (args.numberValue === undefined) {
      throw new Error("Value is required");
    }
    const amount = normalizeFiniteNumber(args.numberValue, "Value");
    if (existing.kind !== "number") return null;
    return normalizeNumberPayload(applyNumericOp(existing.numberValue, operation, amount));
  }

  if (args.numberValue === undefined) {
    throw new Error("Value is required");
  }
  const amount = normalizeFiniteNumber(args.numberValue, "Value");
  if (existing.kind !== "numberRange") return null;
  return normalizeRangePayload(
    applyNumericOp(existing.rangeMin, operation, amount),
    applyNumericOp(existing.rangeMax, operation, amount),
  );
}

async function requireExpectationInClass(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  expectationId: Id<"expectations">,
) {
  const expectation = await ctx.db.get("expectations", expectationId);
  if (!expectation || expectation.classId !== classId) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Expectation not found",
    });
  }
  return expectation;
}

/** Teachers (manage) and assistant teachers (students:read) see the full class roster. */
async function canViewClassExpectationValues(ctx: ClassAuthCtx): Promise<boolean> {
  return (await ctx.can("expectations:manage")) || (await ctx.can("students:read"));
}

/**
 * `null` = full class values; otherwise only values for these student user IDs.
 * Call after `expectations:read` (or manage).
 */
async function resolveExpectationValueAudience(
  ctx: ClassAuthCtx,
  classId: Id<"classes">,
): Promise<ReadonlySet<Id<"users">> | null> {
  if (await canViewClassExpectationValues(ctx)) {
    return null;
  }
  return new Set(await resolvePersonalStudentIds(ctx, classId));
}

function countValuesForExpectation(
  values: ReadonlyArray<Doc<"expectationValues">>,
  expectationId: Id<"expectations">,
  audience: ReadonlySet<Id<"users">> | null,
): number {
  let count = 0;
  for (const value of values) {
    if (value.expectationId !== expectationId) continue;
    if (audience !== null && !audience.has(value.studentUserId)) continue;
    count += 1;
  }
  return count;
}

async function listStudentUserIds(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
): Promise<Array<Id<"users">>> {
  const users = await ctx.runQuery(components.authz.queries.getUsersWithRole, {
    tenantId: APP_CONFIG.authzTenantId,
    role: "student",
    scope: classScope(classId),
  });
  return users.map((entry: { userId: string }) => entry.userId as Id<"users">);
}

async function deleteValuesForExpectation(
  ctx: MutationCtx,
  expectationId: Id<"expectations">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- expectation-scoped cleanup
  const values = await ctx.db
    .query("expectationValues")
    .withIndex("by_expectation", (q) => q.eq("expectationId", expectationId))
    .collect();
  for (const value of values) {
    await ctx.db.delete("expectationValues", value._id);
  }
}

async function upsertValueRow(
  ctx: MutationCtx,
  args: {
    classId: Id<"classes">;
    expectationId: Id<"expectations">;
    studentUserId: Id<"users">;
    payload: ValuePayload;
    updatedBy: Id<"users">;
    updatedAt: number;
  },
): Promise<Id<"expectationValues">> {
  const existing = await ctx.db
    .query("expectationValues")
    .withIndex("by_expectation_student", (q) =>
      q.eq("expectationId", args.expectationId).eq("studentUserId", args.studentUserId),
    )
    .unique();

  const fields = fieldsFromPayload(args.payload);
  if (existing) {
    await ctx.db.patch("expectationValues", existing._id, {
      ...fields,
      updatedAt: args.updatedAt,
      updatedBy: args.updatedBy,
    });
    return existing._id;
  }

  return await ctx.db.insert("expectationValues", {
    classId: args.classId,
    expectationId: args.expectationId,
    studentUserId: args.studentUserId,
    ...fields,
    updatedAt: args.updatedAt,
    updatedBy: args.updatedBy,
  });
}

export const list = classQuery({
  args: {},
  returns: v.array(expectationValidator),
  handler: async (ctx) => {
    await ctx.require("expectations:read");
    const classId = ctx.classDoc._id;
    const audience = await resolveExpectationValueAudience(ctx, classId);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    const expectations = await ctx.db
      .query("expectations")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    const values = await ctx.db
      .query("expectationValues")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();

    const counts = new Map<Id<"expectations">, number>();
    for (const value of values) {
      if (audience !== null && !audience.has(value.studentUserId)) continue;
      counts.set(value.expectationId, (counts.get(value.expectationId) ?? 0) + 1);
    }

    return expectations
      .map((expectation) => ({
        ...expectation,
        valueCount: counts.get(expectation._id) ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name) || a._creationTime - b._creationTime);
  },
});

export const get = classQuery({
  args: {
    expectationId: v.id("expectations"),
  },
  returns: v.union(expectationValidator, v.null()),
  handler: async (ctx, args) => {
    await ctx.require("expectations:read");
    const classId = ctx.classDoc._id;
    const expectation = await ctx.db.get("expectations", args.expectationId);
    if (!expectation || expectation.classId !== classId) {
      return null;
    }

    const audience = await resolveExpectationValueAudience(ctx, classId);
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- expectation-bounded count
    const values = await ctx.db
      .query("expectationValues")
      .withIndex("by_expectation", (q) => q.eq("expectationId", args.expectationId))
      .collect();

    return {
      ...expectation,
      valueCount: countValuesForExpectation(values, args.expectationId, audience),
    };
  },
});

export const listValues = classQuery({
  args: {},
  returns: v.array(expectationValueValidator),
  handler: async (ctx) => {
    await ctx.require("expectations:read");
    const classId = ctx.classDoc._id;
    const audience = await resolveExpectationValueAudience(ctx, classId);
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    const values = await ctx.db
      .query("expectationValues")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();
    if (audience === null) return values;
    return values.filter((value) => audience.has(value.studentUserId));
  },
});

export const listValuesForExpectation = classQuery({
  args: {
    expectationId: v.id("expectations"),
  },
  returns: v.array(expectationValueValidator),
  handler: async (ctx, args) => {
    await ctx.require("expectations:read");
    const classId = ctx.classDoc._id;
    await requireExpectationInClass(ctx, classId, args.expectationId);
    const audience = await resolveExpectationValueAudience(ctx, classId);
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- expectation-bounded list
    const values = await ctx.db
      .query("expectationValues")
      .withIndex("by_expectation", (q) => q.eq("expectationId", args.expectationId))
      .collect();
    if (audience === null) return values;
    return values.filter((value) => audience.has(value.studentUserId));
  },
});

/** Personal/read audience: self (student) or linked students (guardian). */
export const forAudience = classQuery({
  args: {},
  returns: v.object({
    students: v.array(personalStudentValidator),
    expectations: v.array(expectationValidator),
    values: v.array(expectationValueValidator),
  }),
  handler: async (ctx) => {
    await ctx.require("expectations:read");
    const classId = ctx.classDoc._id;
    const studentUserIds = await resolvePersonalStudentIds(ctx, classId);
    if (studentUserIds.length === 0) {
      return { students: [], expectations: [], values: [] };
    }

    const audience = new Set(studentUserIds);
    const students: Array<{
      userId: Id<"users">;
      rosterNumber: number;
      firstName?: string;
      lastName?: string;
      name?: string;
      image?: string;
      email?: string;
    }> = [];

    for (const studentUserId of studentUserIds) {
      const row = await ctx.db
        .query("studentRosters")
        .withIndex("by_classId_userId", (q) => q.eq("classId", classId).eq("userId", studentUserId))
        .unique();
      if (!row) continue;
      const user = await ctx.db.get("users", studentUserId);
      if (!user) continue;
      students.push({
        userId: studentUserId,
        rosterNumber: row.rosterNumber,
        firstName: row.firstName,
        lastName: row.lastName,
        name: user.name,
        image: await resolveUserImageUrl(ctx, user),
        email: user.email,
      });
    }
    students.sort((a, b) => a.rosterNumber - b.rosterNumber);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    const expectations = await ctx.db
      .query("expectations")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    const allValues = await ctx.db
      .query("expectationValues")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();
    const values = allValues.filter((value) => audience.has(value.studentUserId));

    const counts = new Map<Id<"expectations">, number>();
    for (const value of values) {
      counts.set(value.expectationId, (counts.get(value.expectationId) ?? 0) + 1);
    }

    return {
      students,
      expectations: expectations
        .map((expectation) => ({
          ...expectation,
          valueCount: counts.get(expectation._id) ?? 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name) || a._creationTime - b._creationTime),
      values,
    };
  },
});

export const create = classMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    inputType: inputTypeValidator,
    unit: v.string(),
  },
  returns: v.id("expectations"),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "expectationCreate", { key: ctx.userId, throws: true });
    await ctx.require("expectations:manage");

    const classId = ctx.classDoc._id;
    const name = normalizeName(args.name);
    const description = normalizeOptionalDescription(args.description);
    const unit = normalizeUnit(args.unit);
    const now = Date.now();

    const expectationId = await ctx.db.insert("expectations", {
      classId,
      name,
      description,
      inputType: args.inputType,
      unit,
      createdBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "expectation",
      resourceId: expectationId,
      summary: `Created expectation "${name}"`,
      summaryKey: "activitySummary_createdExpectation",
      metadata: { name, inputType: args.inputType, unit },
    });

    return expectationId;
  },
});

export const update = classMutation({
  args: {
    expectationId: v.id("expectations"),
    name: v.string(),
    description: v.optional(v.string()),
    inputType: inputTypeValidator,
    unit: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "expectationUpdate", { key: ctx.userId, throws: true });
    await ctx.require("expectations:manage");

    const classId = ctx.classDoc._id;
    const existing = await requireExpectationInClass(ctx, classId, args.expectationId);
    const name = normalizeName(args.name);
    const description = normalizeOptionalDescription(args.description);
    const unit = normalizeUnit(args.unit);
    const inputTypeChanged = existing.inputType !== args.inputType;

    if (inputTypeChanged) {
      await deleteValuesForExpectation(ctx, args.expectationId);
    }

    await ctx.db.patch("expectations", args.expectationId, {
      name,
      description,
      inputType: args.inputType,
      unit,
      updatedAt: Date.now(),
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "expectation",
      resourceId: args.expectationId,
      summary: `Updated expectation "${name}"`,
      summaryKey: "activitySummary_updatedExpectation",
      metadata: {
        name,
        inputType: args.inputType,
        unit,
        ...(inputTypeChanged ? { clearedValues: "true" } : {}),
      },
    });

    return null;
  },
});

export const remove = classMutation({
  args: {
    expectationId: v.id("expectations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "expectationRemove", { key: ctx.userId, throws: true });
    await ctx.require("expectations:manage");

    const classId = ctx.classDoc._id;
    const existing = await requireExpectationInClass(ctx, classId, args.expectationId);
    await deleteValuesForExpectation(ctx, args.expectationId);
    await ctx.db.delete("expectations", args.expectationId);

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "expectation",
      resourceId: args.expectationId,
      summary: `Deleted expectation "${existing.name}"`,
      summaryKey: "activitySummary_deletedExpectation",
      metadata: { name: existing.name },
    });

    return null;
  },
});

export const upsertValue = classMutation({
  args: {
    expectationId: v.id("expectations"),
    studentUserId: v.id("users"),
    numberValue: v.optional(v.number()),
    rangeMin: v.optional(v.number()),
    rangeMax: v.optional(v.number()),
    clear: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "expectationUpsertValue", { key: ctx.userId, throws: true });
    await ctx.require("expectations:manage");

    const classId = ctx.classDoc._id;
    const expectation = await requireExpectationInClass(ctx, classId, args.expectationId);
    const studentIds = await listStudentUserIds(ctx, classId);
    if (!studentIds.includes(args.studentUserId)) {
      throw new Error("Student not found in this class");
    }

    const existing = await ctx.db
      .query("expectationValues")
      .withIndex("by_expectation_student", (q) =>
        q.eq("expectationId", args.expectationId).eq("studentUserId", args.studentUserId),
      )
      .unique();

    if (args.clear) {
      if (existing) {
        await ctx.db.delete("expectationValues", existing._id);
        await recordClassActivity(ctx, {
          classId,
          actorUserId: ctx.userId,
          action: "delete",
          resourceType: "expectation",
          resourceId: args.expectationId,
          summary: `Cleared value for expectation "${expectation.name}"`,
          summaryKey: "activitySummary_clearedExpectationValue",
          metadata: {
            name: expectation.name,
            studentUserId: args.studentUserId,
          },
        });
      }
      return null;
    }

    const payload = payloadForExpectation(expectation, args);
    await upsertValueRow(ctx, {
      classId,
      expectationId: args.expectationId,
      studentUserId: args.studentUserId,
      payload,
      updatedBy: ctx.userId,
      updatedAt: Date.now(),
    });
    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: existing ? "update" : "write",
      resourceType: "expectation",
      resourceId: args.expectationId,
      summary: `Updated value for expectation "${expectation.name}"`,
      summaryKey: "activitySummary_upsertedExpectationValue",
      metadata: {
        name: expectation.name,
        studentUserId: args.studentUserId,
      },
    });
    return null;
  },
});

export const upsertStudentValues = classMutation({
  args: {
    studentUserId: v.id("users"),
    values: v.array(
      v.object({
        expectationId: v.id("expectations"),
        numberValue: v.optional(v.number()),
        rangeMin: v.optional(v.number()),
        rangeMax: v.optional(v.number()),
        clear: v.optional(v.boolean()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "expectationUpsertStudentValues", {
      key: ctx.userId,
      throws: true,
    });
    await ctx.require("expectations:manage");

    const classId = ctx.classDoc._id;
    const studentIds = await listStudentUserIds(ctx, classId);
    if (!studentIds.includes(args.studentUserId)) {
      throw new Error("Student not found in this class");
    }

    if (args.values.length === 0) {
      return null;
    }

    const now = Date.now();
    let valueCount = 0;
    let clearedCount = 0;
    for (const entry of args.values) {
      const expectation = await requireExpectationInClass(ctx, classId, entry.expectationId);
      const existing = await ctx.db
        .query("expectationValues")
        .withIndex("by_expectation_student", (q) =>
          q.eq("expectationId", entry.expectationId).eq("studentUserId", args.studentUserId),
        )
        .unique();

      if (entry.clear) {
        if (existing) {
          await ctx.db.delete("expectationValues", existing._id);
          clearedCount += 1;
        }
        continue;
      }

      const payload = payloadForExpectation(expectation, entry);
      await upsertValueRow(ctx, {
        classId,
        expectationId: entry.expectationId,
        studentUserId: args.studentUserId,
        payload,
        updatedBy: ctx.userId,
        updatedAt: now,
      });
      valueCount += 1;
    }

    if (valueCount > 0 || clearedCount > 0) {
      await recordClassActivity(ctx, {
        classId,
        actorUserId: ctx.userId,
        action: "update",
        resourceType: "expectation",
        resourceId: args.studentUserId,
        summary: `Updated expectation values for a student (${valueCount} set, ${clearedCount} cleared)`,
        summaryKey: "activitySummary_upsertedStudentExpectationValues",
        metadata: {
          studentUserId: args.studentUserId,
          valueCount: String(valueCount),
          clearedCount: String(clearedCount),
        },
      });
    }

    return null;
  },
});

export const bulkApply = classMutation({
  args: {
    expectationId: v.id("expectations"),
    operation: bulkOperationValidator,
    numberValue: v.optional(v.number()),
    rangeMin: v.optional(v.number()),
    rangeMax: v.optional(v.number()),
  },
  returns: v.object({
    updatedCount: v.number(),
    skippedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "expectationBulkApply", { key: ctx.userId, throws: true });
    await ctx.require("expectations:manage");

    const classId = ctx.classDoc._id;
    const expectation = await requireExpectationInClass(ctx, classId, args.expectationId);
    const studentIds = await listStudentUserIds(ctx, classId);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- expectation-bounded list
    const existingValues = await ctx.db
      .query("expectationValues")
      .withIndex("by_expectation", (q) => q.eq("expectationId", args.expectationId))
      .collect();
    const byStudent = new Map(existingValues.map((row) => [row.studentUserId, row]));

    const now = Date.now();
    let updatedCount = 0;
    let skippedCount = 0;

    for (const studentUserId of studentIds) {
      const existingRow = byStudent.get(studentUserId) ?? null;
      const existingPayload = existingRow ? readPayload(expectation, existingRow) : null;
      const nextPayload = applyBulkToPayload(expectation, existingPayload, args.operation, args);

      if (!nextPayload) {
        skippedCount += 1;
        continue;
      }

      await upsertValueRow(ctx, {
        classId,
        expectationId: args.expectationId,
        studentUserId,
        payload: nextPayload,
        updatedBy: ctx.userId,
        updatedAt: now,
      });
      updatedCount += 1;
    }

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "expectation",
      resourceId: args.expectationId,
      summary: `Bulk-updated expectation "${expectation.name}" for ${updatedCount} students`,
      summaryKey: "activitySummary_bulkUpdatedExpectation",
      metadata: {
        name: expectation.name,
        operation: args.operation,
        updatedCount: String(updatedCount),
        skippedCount: String(skippedCount),
      },
    });

    return { updatedCount, skippedCount };
  },
});
