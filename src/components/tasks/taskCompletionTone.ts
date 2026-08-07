export type TaskCompletionTone = "done" | "notDone";

export const TASK_COMPLETION_BADGE_CLASS: Record<TaskCompletionTone, string> = {
  done: "border-green-600 text-green-700 dark:border-green-400 dark:text-green-400",
  notDone: "border-destructive text-destructive",
};

export const TASK_COMPLETION_CARD_RING_CLASS: Record<TaskCompletionTone, string> = {
  done: "ring-green-600 dark:ring-green-400",
  notDone: "ring-destructive",
};

export function completionTone(completed: boolean): TaskCompletionTone {
  return completed ? "done" : "notDone";
}
