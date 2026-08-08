export type TaskCompletionTone = "done" | "notDone" | "late";

export const TASK_COMPLETION_BADGE_CLASS: Record<TaskCompletionTone, string> = {
  done: "border-green-600 text-green-700 dark:border-green-400 dark:text-green-400",
  notDone: "border-destructive text-destructive",
  late: "border-amber-600 text-amber-700 dark:border-amber-400 dark:text-amber-400",
};

export const TASK_COMPLETION_CARD_RING_CLASS: Record<TaskCompletionTone, string> = {
  done: "ring-green-600 dark:ring-green-400",
  notDone: "ring-destructive",
  late: "ring-amber-600 dark:ring-amber-400",
};

export function completionTone(completed: boolean, pastDue = false): TaskCompletionTone {
  if (completed) return "done";
  return pastDue ? "late" : "notDone";
}
