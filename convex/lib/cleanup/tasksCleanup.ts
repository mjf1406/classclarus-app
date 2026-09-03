import type { Id } from "../../_generated/dataModel.js";
import type { MutationCtx } from "../../_generated/server.js";
import { cancelScheduledJob } from "../release/scheduledRelease.js";

async function deleteLinksForTask(ctx: MutationCtx, taskId: Id<"tasks">): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- task-scoped cleanup
  const links = await ctx.db
    .query("taskStudentLinks")
    .withIndex("by_task", (q) => q.eq("taskId", taskId))
    .collect();
  for (const link of links) {
    await ctx.db.delete("taskStudentLinks", link._id);
  }
}

/** Delete a task and its completion rows. Attachment files stay in the class library. */
export async function deleteTaskWithCompletions(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
): Promise<void> {
  const task = await ctx.db.get("tasks", taskId);
  if (task) {
    await cancelScheduledJob(ctx, task.scheduledReleaseJobId);
  }
  await deleteLinksForTask(ctx, taskId);
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
  const links = await ctx.db
    .query("taskStudentLinks")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const link of links) {
    await ctx.db.delete("taskStudentLinks", link._id);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const task of tasks) {
    await cancelScheduledJob(ctx, task.scheduledReleaseJobId);
    await ctx.db.delete("tasks", task._id);
  }
}
