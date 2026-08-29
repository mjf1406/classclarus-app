import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { TaskCompletionStatusBadge } from "@/components/tasks/TaskCompletionStatusBadge";
import { DashboardSectionCard } from "@/components/dashboard/DashboardSectionCard";
import { useTasks } from "@/hooks/tasks/useTasks";
import { formatLocalizedDateTime, formatLocalizedDueDate } from "@/i18n/formatDate";
import { recentDashboardTasks } from "@/lib/dashboard/dashboard";
import { areAllStudentsCompleteOnTask, isTaskPastDue } from "@/lib/tasks/tasks";
import type { Id } from "../../../convex/_generated/dataModel";

type DashboardTasksCardProps = {
  classId: Id<"classes">;
  studentUserId: Id<"users"> | null;
};

export function DashboardTasksCard({ classId, studentUserId }: DashboardTasksCardProps) {
  const { t } = useTranslation("classes");
  const { t: tTasks } = useTranslation("tasks");
  const query = useTasks(classId);
  const tasks = useMemo(() => recentDashboardTasks(query.data ?? []), [query.data]);
  const empty = !query.isPending && !query.isError && tasks.length === 0;
  const studentIds = studentUserId ? [studentUserId] : [];

  return (
    <DashboardSectionCard
      title={t("dashboardTasksTitle")}
      viewAllLabel={t("dashboardViewAll")}
      viewAllTo="/class/$classId/tasks"
      viewAllParams={{ classId }}
      isPending={query.isPending}
      isError={query.isError}
      errorTitle={t("dashboardLoadFailed")}
      errorDescription={t("dashboardLoadFailedDescription")}
      onRetry={() => void query.refetch()}
      empty={empty}
      emptyTitle={t("dashboardNoTasksTitle")}
      emptyDescription={t("dashboardNoTasksDescription")}
    >
      {tasks.map((task) => {
        const allDone = areAllStudentsCompleteOnTask(task, studentIds);
        const pastDue = isTaskPastDue(task.dueDateKey);

        return (
          <Link
            key={task._id}
            to="/class/$classId/tasks/$taskId"
            params={{ classId, taskId: task._id }}
            className="flex flex-col gap-2 rounded-xl border px-3 py-2 transition-colors hover:bg-accent/40"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium">{task.name}</span>
              {studentIds.length > 0 ? (
                <TaskCompletionStatusBadge completed={allDone} pastDue={pastDue} />
              ) : null}
            </div>
            {task.dueDateKey ? (
              <span className="text-xs text-muted-foreground">
                {tTasks("dueDateValue", { date: formatLocalizedDueDate(task.dueDateKey) })}
              </span>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {tTasks("updatedAt", { date: formatLocalizedDateTime(task.updatedAt) })}
            </span>
          </Link>
        );
      })}
    </DashboardSectionCard>
  );
}
