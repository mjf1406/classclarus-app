import type { Id } from "../../_generated/dataModel.js";
import type { MutationCtx } from "../../_generated/server.js";

/** Delete a task and its completion rows. */
export async function deleteTaskWithCompletions(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- task-scoped cleanup
  const completions = await ctx.db
    .query("taskCompletions")
    .withIndex("by_task", (q) => q.eq("taskId", taskId))
    .collect();
  for (const completion of completions) {
    await ctx.db.delete("taskCompletions", completion._id);
  }
  await ctx.db.delete("tasks", taskId);
}

/** Cascade-delete tasks and completions for a class. */
export async function deleteTasksForClass(ctx: MutationCtx, classId: Id<"classes">): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const completions = await ctx.db
    .query("taskCompletions")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const completion of completions) {
    await ctx.db.delete("taskCompletions", completion._id);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const task of tasks) {
    await ctx.db.delete("tasks", task._id);
  }
}
