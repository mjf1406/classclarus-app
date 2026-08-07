import type { Id } from "../_generated/dataModel.js";
import type { MutationCtx } from "../_generated/server.js";

/** Cascade-delete reward purchases, rewards, and folders for a class. */
export async function deleteRewardsForClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const purchases = await ctx.db
    .query("rewardPurchases")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const purchase of purchases) {
    await ctx.db.delete("rewardPurchases", purchase._id);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const rewards = await ctx.db
    .query("rewards")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const reward of rewards) {
    await ctx.db.delete("rewards", reward._id);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const folders = await ctx.db
    .query("rewardFolders")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const folder of folders) {
    await ctx.db.delete("rewardFolders", folder._id);
  }
}
