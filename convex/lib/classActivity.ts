import { authz } from "../authz.js";
import type { Doc, Id } from "../_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "../_generated/server.js";
import { classScope, isClassRole, pickHighestClassRole } from "./authzModel.js";

export const ACTIVITY_ACTIONS = ["read", "write", "update", "delete"] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const ACTIVITY_RESOURCE_TYPES = [
  "class",
  "member",
  "joinCode",
  "file",
  "guardianLink",
  "activity",
  "group",
  "team",
  "groupMembership",
  "announcement",
  "attendance",
  "razAssessment",
  "seatLayout",
  "seatConstraint",
  "seatChart",
  "seatAlgorithmSettings",
] as const;
export type ActivityResourceType = (typeof ACTIVITY_RESOURCE_TYPES)[number];

/** Skip duplicate intentional-read rows within this window. */
export const READ_DEDUPE_WINDOW_MS = 15 * 60 * 1000;

export const ACTIVITY_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

export const ACTIVITY_PURGE_BATCH_SIZE = 100;

const UNKNOWN_EMAIL = "(unknown)";
export const UNKNOWN_ACTOR_ROLE = "(unknown)";

export type RecordClassActivityArgs = {
  classId: Id<"classes">;
  actorUserId: Id<"users">;
  action: ActivityAction;
  resourceType: ActivityResourceType | string;
  resourceId?: string;
  summary: string;
  /** i18n key for client-side summary formatting; English `summary` remains the audit fallback. */
  summaryKey?: string;
  metadata?: Record<string, string>;
};

async function resolveActorEmail(ctx: MutationCtx, actorUserId: Id<"users">): Promise<string> {
  const user = await ctx.db.get("users", actorUserId);
  const email = user?.email?.trim();
  return email && email.length > 0 ? email : UNKNOWN_EMAIL;
}

async function resolveActorRole(
  ctx: MutationCtx,
  classId: Id<"classes">,
  actorUserId: Id<"users">,
): Promise<string> {
  const entries = await authz.getUserRoles(ctx, actorUserId, classScope(classId));
  const role = pickHighestClassRole(
    entries.map((entry: { role: string }) => entry.role).filter(isClassRole),
  );
  return role ?? UNKNOWN_ACTOR_ROLE;
}

/**
 * Append a class activity event. Snapshots actor email + class role at write time.
 */
export async function recordClassActivity(
  ctx: MutationCtx,
  args: RecordClassActivityArgs,
): Promise<Id<"classActivityEvents">> {
  const createdAt = Date.now();
  const [actorEmail, actorRole] = await Promise.all([
    resolveActorEmail(ctx, args.actorUserId),
    resolveActorRole(ctx, args.classId, args.actorUserId),
  ]);
  return await ctx.db.insert("classActivityEvents", {
    classId: args.classId,
    actorUserId: args.actorUserId,
    actorEmail,
    actorRole,
    action: args.action,
    resourceType: args.resourceType,
    ...(args.resourceId !== undefined ? { resourceId: args.resourceId } : {}),
    summary: args.summary,
    ...(args.summaryKey !== undefined ? { summaryKey: args.summaryKey } : {}),
    ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
    createdAt,
  });
}

function sameResourceId(a: string | undefined, b: string | undefined): boolean {
  return (a ?? "") === (b ?? "");
}

/**
 * Returns true when an equivalent read was logged recently (same actor/resource).
 */
export async function hasRecentMatchingActivity(
  ctx: MutationCtx,
  args: {
    classId: Id<"classes">;
    actorUserId: Id<"users">;
    action: ActivityAction;
    resourceType: string;
    resourceId?: string;
    windowMs?: number;
  },
): Promise<boolean> {
  const windowMs = args.windowMs ?? READ_DEDUPE_WINDOW_MS;
  const since = Date.now() - windowMs;
  const recent = await ctx.db
    .query("classActivityEvents")
    .withIndex("by_class_createdAt", (q) => q.eq("classId", args.classId).gte("createdAt", since))
    .order("desc")
    .take(50);

  return recent.some(
    (event) =>
      event.actorUserId === args.actorUserId &&
      event.action === args.action &&
      event.resourceType === args.resourceType &&
      sameResourceId(event.resourceId, args.resourceId),
  );
}

/**
 * Delete up to `ACTIVITY_PURGE_BATCH_SIZE` activity rows for a class.
 * Returns how many were deleted (caller may schedule another batch).
 */
export async function deleteActivityBatchForClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<number> {
  const batch = await ctx.db
    .query("classActivityEvents")
    .withIndex("by_class_createdAt", (q) => q.eq("classId", classId))
    .take(ACTIVITY_PURGE_BATCH_SIZE);

  for (const event of batch) {
    await ctx.db.delete("classActivityEvents", event._id);
  }
  return batch.length;
}

export type ClassActivityEventPublic = {
  _id: Id<"classActivityEvents">;
  _creationTime: number;
  classId: Id<"classes">;
  actorUserId: Id<"users">;
  actorEmail: string;
  actorRole: string;
  action: ActivityAction;
  resourceType: string;
  resourceId?: string;
  summary: string;
  summaryKey?: string;
  metadata?: Record<string, string>;
  createdAt: number;
};

export function toPublicActivityEvent(doc: Doc<"classActivityEvents">): ClassActivityEventPublic {
  return {
    _id: doc._id,
    _creationTime: doc._creationTime,
    classId: doc.classId,
    actorUserId: doc.actorUserId,
    actorEmail: doc.actorEmail,
    actorRole: doc.actorRole ?? UNKNOWN_ACTOR_ROLE,
    action: doc.action,
    resourceType: doc.resourceType,
    ...(doc.resourceId !== undefined ? { resourceId: doc.resourceId } : {}),
    summary: doc.summary,
    ...(doc.summaryKey !== undefined ? { summaryKey: doc.summaryKey } : {}),
    ...(doc.metadata !== undefined ? { metadata: doc.metadata } : {}),
    createdAt: doc.createdAt,
  };
}

/** Resource types that invalidate personal points ledger names/rows. */
export const LEDGER_REVISION_RESOURCE_TYPES = [
  "behaviorApplication",
  "rewardPurchase",
  "studentWarning",
  "behavior",
  "reward",
] as const;

/** Resource types that invalidate personal attendance history. */
export const HISTORY_REVISION_RESOURCE_TYPES = ["attendance"] as const;

export type ActivityRevision = {
  eventId: Id<"classActivityEvents">;
  createdAt: number;
};

/**
 * Newest activity event across the given resource types (indexed `.first()` per type).
 * Returns null when none of the types have events for the class.
 */
export async function getNewestActivityRevision(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  classId: Id<"classes">,
  resourceTypes: readonly string[],
): Promise<ActivityRevision | null> {
  let newest: ActivityRevision | null = null;

  for (const resourceType of resourceTypes) {
    const event = await ctx.db
      .query("classActivityEvents")
      .withIndex("by_class_resource_createdAt", (q) =>
        q.eq("classId", classId).eq("resourceType", resourceType),
      )
      .order("desc")
      .first();

    if (
      event &&
      (newest === null ||
        event.createdAt > newest.createdAt ||
        (event.createdAt === newest.createdAt && event._id > newest.eventId))
    ) {
      newest = { eventId: event._id, createdAt: event.createdAt };
    }
  }

  return newest;
}
