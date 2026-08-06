import type { Id } from "../_generated/dataModel.js";
import type { MutationCtx } from "../_generated/server.js";

async function cancelExpirationJob(
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

export async function deleteJoinCodeById(
  ctx: MutationCtx,
  joinCodeId: Id<"joinCodes">,
): Promise<void> {
  const codeDoc = await ctx.db.get("joinCodes", joinCodeId);
  if (!codeDoc) return;
  await cancelExpirationJob(ctx, codeDoc.expirationJobId);
  await ctx.db.delete("joinCodes", joinCodeId);
}

export async function deleteJoinCodesForClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<void> {
  // Bounded per class; invite codes are short-lived and intentionally few.
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- mutation cleanup, not a public query
  const codes = await ctx.db
    .query("joinCodes")
    .withIndex("by_class", (q) => q.eq("classId", classId))
    .collect();
  for (const code of codes) {
    await cancelExpirationJob(ctx, code.expirationJobId);
    await ctx.db.delete("joinCodes", code._id);
  }
}
