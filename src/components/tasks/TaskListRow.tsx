import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { TaskCompletionStatusBadge } from "@/components/tasks/TaskCompletionStatusBadge";
import { formatLocalizedDueDate } from "@/i18n/formatDate";
import { isTaskPastDue, type TaskListItem } from "@/lib/tasks/tasks";
import type { Id } from "../../../convex/_generated/dataModel";

type TaskListRowProps = {
  classId: Id<"classes">;
  task: TaskListItem;
  showProcedureStepNumber?: boolean;
};

export function TaskListRow({ classId, task, showProcedureStepNumber = false }: TaskListRowProps) {
  const { t } = useTranslation("tasks");
  const completed = task.studentCount > 0 && task.completedCount >= task.studentCount;
  const pastDue = isTaskPastDue(task.dueDateKey);
  const title =
    showProcedureStepNumber && task.procedureStepNumber !== undefined
      ? t("procedureStepTaskName", { number: task.procedureStepNumber, name: task.name })
      : task.name;
  const multiStudent = task.studentCount > 1;

  return (
    <Link
      to="/class/$classId/tasks/$taskId"
      params={{ classId, taskId: task._id }}
      className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-accent/40"
    >
      <span className="min-w-0">
        <span className="block truncate font-medium">{title}</span>
        {task.dueDateKey ? (
          <span className="block truncate text-xs text-muted-foreground">
            {t("dueDateValue", { date: formatLocalizedDueDate(task.dueDateKey) })}
          </span>
        ) : null}
      </span>
      {task.studentCount > 0 ? (
        <TaskCompletionStatusBadge
          completed={completed}
          pastDue={pastDue}
          label={
            multiStudent
              ? completed
                ? t("statusAllDone")
                : t("statsCompleted", {
                    completed: task.completedCount,
                    total: task.studentCount,
                  })
              : undefined
          }
        />
      ) : null}
    </Link>
  );
}
