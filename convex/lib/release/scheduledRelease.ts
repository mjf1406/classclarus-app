import type { FunctionReference } from "convex/server";

import type { Id } from "../../_generated/dataModel.js";
import type { MutationCtx } from "../../_generated/server.js";

export type ReleasePatch = {
  hiddenFromStudents: boolean | undefined;
  scheduledReleaseAt: number | undefined;
  scheduledReleaseJobId: Id<"_scheduled_functions"> | undefined;
};

export type ReleaseFields = {
  hiddenFromStudents?: boolean;
  scheduledReleaseAt?: number;
  scheduledReleaseJobId?: Id<"_scheduled_functions">;
};

export function isHiddenFromStudents(doc: { hiddenFromStudents?: boolean }): boolean {
  return doc.hiddenFromStudents === true;
}

export function publicReleaseFields(doc: ReleaseFields): {
  hiddenFromStudents: boolean;
  scheduledReleaseAt?: number;
} {
  return {
    hiddenFromStudents: doc.hiddenFromStudents === true,
    ...(doc.scheduledReleaseAt !== undefined ? { scheduledReleaseAt: doc.scheduledReleaseAt } : {}),
  };
}

export async function cancelScheduledJob(
  ctx: MutationCtx,
  jobId: Id<"_scheduled_functions"> | undefined,
): Promise<void> {
  if (!jobId) return;
  try {
    await ctx.scheduler.cancel(jobId);
  } catch {
    // Job may already have run or been canceled.
  }
}

export function normalizeReleaseInput(input: {
  hiddenFromStudents?: boolean;
  scheduledReleaseAt?: number;
  now?: number;
}): { hiddenFromStudents: boolean; scheduledReleaseAt?: number } {
  const now = input.now ?? Date.now();
  const scheduledReleaseAt = input.scheduledReleaseAt;
  if (scheduledReleaseAt !== undefined) {
    if (!Number.isFinite(scheduledReleaseAt)) {
      throw new Error("Scheduled release time is invalid");
    }
    if (scheduledReleaseAt <= now) {
      return { hiddenFromStudents: false };
    }
    return { hiddenFromStudents: true, scheduledReleaseAt };
  }
  return { hiddenFromStudents: input.hiddenFromStudents === true };
}

export async function applyReleaseSchedule(
  ctx: MutationCtx,
  args: {
    existingJobId?: Id<"_scheduled_functions">;
    hiddenFromStudents?: boolean;
    scheduledReleaseAt?: number;
    schedule: FunctionReference<"mutation", "internal">;
    scheduleArgs: { taskId: Id<"tasks"> } | { assignmentId: Id<"assignments"> };
  },
): Promise<ReleasePatch> {
  await cancelScheduledJob(ctx, args.existingJobId);
  const normalized = normalizeReleaseInput({
    hiddenFromStudents: args.hiddenFromStudents,
    scheduledReleaseAt: args.scheduledReleaseAt,
  });
  if (normalized.scheduledReleaseAt === undefined) {
    return {
      hiddenFromStudents: normalized.hiddenFromStudents ? true : undefined,
      scheduledReleaseAt: undefined,
      scheduledReleaseJobId: undefined,
    };
  }
  const scheduledReleaseJobId = await ctx.scheduler.runAt(
    normalized.scheduledReleaseAt,
    args.schedule,
    args.scheduleArgs as never,
  );
  return {
    hiddenFromStudents: true,
    scheduledReleaseAt: normalized.scheduledReleaseAt,
    scheduledReleaseJobId,
  };
}
