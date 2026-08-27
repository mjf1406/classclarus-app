import { useTranslation } from "react-i18next";

import type { TaskGroupCompletionStat } from "@/lib/tasks/tasks";
import { cn } from "@/lib/utils";

type TaskCompletionGroupStatsProps = {
  completedCount: number;
  studentCount: number;
  groupStats: TaskGroupCompletionStat[];
  className?: string;
  allDone?: boolean;
};

export function TaskCompletionGroupStats({
  completedCount,
  studentCount,
  groupStats,
  className,
  allDone = false,
}: TaskCompletionGroupStatsProps) {
  const { t } = useTranslation("tasks");

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <p className={cn(allDone && "font-medium text-green-700 dark:text-green-400")}>
        {t("statsCompleted", {
          completed: completedCount,
          total: studentCount,
        })}
      </p>
      {groupStats.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-xs">
          {groupStats.map((row) => (
            <li key={row.groupId} className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate">{row.name}</span>
              <span className="shrink-0 tabular-nums">
                {t("statsGroupCompleted", {
                  completed: row.completedCount,
                  total: row.studentCount,
                })}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
