import { v } from "convex/values";

import { internal } from "./_generated/api.js";
import type { Doc, Id } from "./_generated/dataModel.js";
import type { MutationCtx } from "./_generated/server.js";
import { internalMutation } from "./_generated/server.js";
import { authedMutation, authedQuery } from "./lib/customFunctions.js";
import {
  CLASS_DELETION_STAGE_COUNT,
  CLASS_DELETION_STAGES,
  deletionProgressPercent,
  isValidDeletionStage,
  nextDeletionStage,
  runDeletionStage,
  type ClassDeletionStage,
} from "./lib/cleanup/deleteClass.js";

const COMPLETED_JOB_RETENTION_MS = 10 * 60 * 1000;

export const deletionJobStatusValidator = v.object({
  _id: v.id("classDeletionJobs"),
  classId: v.id("classes"),
  className: v.string(),
  status: v.union(
    v.literal("queued"),
    v.literal("running"),
    v.literal("completed"),
    v.literal("failed"),
  ),
  currentStage: v.string(),
  completedStageCount: v.number(),
  totalStageCount: v.number(),
  progressPercent: v.number(),
  errorMessage: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  completedAt: v.optional(v.number()),
});

function toPublicJob(job: Doc<"classDeletionJobs">) {
  return {
    _id: job._id,
    classId: job.classId,
    className: job.className,
    status: job.status,
    currentStage: job.currentStage,
    completedStageCount: job.completedStageCount,
    totalStageCount: job.totalStageCount,
    progressPercent: deletionProgressPercent(job.completedStageCount),
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
  };
}

/**
 * Active and recently completed deletion jobs for the current user (progress toasts).
 */
export const listForRequester = authedQuery({
  args: {},
  returns: v.array(deletionJobStatusValidator),
  handler: async (ctx) => {
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- bounded per user
    const jobs = await ctx.db
      .query("classDeletionJobs")
      .withIndex("by_requesterUserId", (q) => q.eq("requesterUserId", ctx.userId))
      .collect();

    const cutoff = Date.now() - COMPLETED_JOB_RETENTION_MS;
    return jobs
      .filter((job) => {
        if (job.status === "completed") {
          return (job.completedAt ?? job.updatedAt) >= cutoff;
        }
        return true;
      })
      .map(toPublicJob)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/**
 * Retry a failed deletion job (original requester only).
 */
export const retry = authedMutation({
  args: {
    jobId: v.id("classDeletionJobs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get("classDeletionJobs", args.jobId);
    if (!job || job.requesterUserId !== ctx.userId) {
      throw new Error("Deletion job not found");
    }
    if (job.status !== "failed") {
      throw new Error("Only failed deletion jobs can be retried");
    }

    const classDoc = await ctx.db.get("classes", job.classId);
    if (!classDoc) {
      await ctx.db.patch("classDeletionJobs", job._id, {
        status: "completed",
        completedStageCount: job.totalStageCount,
        completedAt: Date.now(),
        updatedAt: Date.now(),
        errorMessage: undefined,
      });
      return null;
    }

    const now = Date.now();
    await ctx.db.patch("classDeletionJobs", job._id, {
      status: "queued",
      errorMessage: undefined,
      updatedAt: now,
    });
    await ctx.db.patch("classes", job.classId, {
      deletingAt: classDoc.deletingAt ?? now,
      deletionJobId: job._id,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.classDeletion.processJob, { jobId: job._id });
    return null;
  },
});

export const processJob = internalMutation({
  args: {
    jobId: v.id("classDeletionJobs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get("classDeletionJobs", args.jobId);
    if (!job) {
      return null;
    }
    if (job.status === "completed") {
      return null;
    }

    const now = Date.now();
    if (job.status === "queued") {
      await ctx.db.patch("classDeletionJobs", job._id, {
        status: "running",
        updatedAt: now,
      });
    }

    const classDoc = await ctx.db.get("classes", job.classId);
    if (!classDoc && job.currentStage !== "finalize") {
      await ctx.db.patch("classDeletionJobs", job._id, {
        status: "completed",
        completedStageCount: job.totalStageCount,
        completedAt: now,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(COMPLETED_JOB_RETENTION_MS, internal.classDeletion.purgeJob, {
        jobId: job._id,
      });
      return null;
    }

    const stage: ClassDeletionStage = isValidDeletionStage(job.currentStage)
      ? job.currentStage
      : CLASS_DELETION_STAGES[0];

    try {
      const { stageComplete } = await runDeletionStage(ctx, job.classId, stage);

      if (!stageComplete) {
        await ctx.db.patch("classDeletionJobs", job._id, {
          status: "running",
          currentStage: stage,
          updatedAt: Date.now(),
        });
        await ctx.scheduler.runAfter(0, internal.classDeletion.processJob, { jobId: job._id });
        return null;
      }

      const nextStage = nextDeletionStage(stage);
      if (nextStage) {
        await ctx.db.patch("classDeletionJobs", job._id, {
          status: "running",
          currentStage: nextStage,
          completedStageCount: job.completedStageCount + 1,
          updatedAt: Date.now(),
        });
        await ctx.scheduler.runAfter(0, internal.classDeletion.processJob, { jobId: job._id });
        return null;
      }

      await ctx.db.patch("classDeletionJobs", job._id, {
        status: "completed",
        currentStage: stage,
        completedStageCount: job.totalStageCount,
        completedAt: Date.now(),
        updatedAt: Date.now(),
        errorMessage: undefined,
      });
      await ctx.scheduler.runAfter(COMPLETED_JOB_RETENTION_MS, internal.classDeletion.purgeJob, {
        jobId: job._id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Class deletion failed";
      console.error("Class deletion job failed", {
        jobId: job._id,
        classId: job.classId,
        stage,
        message,
      });
      await ctx.db.patch("classDeletionJobs", job._id, {
        status: "failed",
        currentStage: stage,
        errorMessage: message,
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});

/** Remove completed job rows after the client retention window. */
export const purgeJob = internalMutation({
  args: {
    jobId: v.id("classDeletionJobs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get("classDeletionJobs", args.jobId);
    if (!job || job.status !== "completed") {
      return null;
    }
    await ctx.db.delete("classDeletionJobs", args.jobId);
    return null;
  },
});

/** Create a deletion job and schedule the worker. Called from `classes.remove`. */
export async function startClassDeletionJob(
  ctx: MutationCtx,
  args: {
    classId: Id<"classes">;
    requesterUserId: Id<"users">;
    className: string;
  },
): Promise<Id<"classDeletionJobs">> {
  const queued = await ctx.db
    .query("classDeletionJobs")
    .withIndex("by_classId_status", (q) => q.eq("classId", args.classId).eq("status", "queued"))
    .first();
  if (queued) {
    return queued._id;
  }

  const running = await ctx.db
    .query("classDeletionJobs")
    .withIndex("by_classId_status", (q) => q.eq("classId", args.classId).eq("status", "running"))
    .first();
  if (running) {
    return running._id;
  }

  const now = Date.now();
  const firstStage: ClassDeletionStage = CLASS_DELETION_STAGES[0];
  const jobId = await ctx.db.insert("classDeletionJobs", {
    classId: args.classId,
    requesterUserId: args.requesterUserId,
    className: args.className,
    status: "queued",
    currentStage: firstStage,
    completedStageCount: 0,
    totalStageCount: CLASS_DELETION_STAGE_COUNT,
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.patch("classes", args.classId, {
    deletingAt: now,
    deletionJobId: jobId,
    updatedAt: now,
  });

  await ctx.scheduler.runAfter(0, internal.classDeletion.processJob, { jobId });
  return jobId;
}
