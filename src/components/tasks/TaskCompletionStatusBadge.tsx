import { useTranslation } from "react-i18next";

import { TASK_COMPLETION_BADGE_CLASS, completionTone } from "@/components/tasks/taskCompletionTone";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type TaskCompletionStatusBadgeProps = {
  completed: boolean;
  /** When true and incomplete, shows Late first, then Not done (late color on both). */
  pastDue?: boolean;
  className?: string;
  /** Override completion label (e.g. "1 / 2 done" for multi-student personal cards). */
  label?: string;
};

export function TaskCompletionStatusBadge({
  completed,
  pastDue = false,
  className,
  label,
}: TaskCompletionStatusBadgeProps) {
  const { t } = useTranslation("tasks");
  const tone = completionTone(completed, pastDue);
  const completionLabel = label ?? (completed ? t("statusDone") : t("statusNotDone"));
  const showLate = pastDue && !completed;

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-2", className)}>
      {showLate ? (
        <Badge variant="outline" className={TASK_COMPLETION_BADGE_CLASS.late}>
          {t("statusLate")}
        </Badge>
      ) : null}
      <Badge variant="outline" className={TASK_COMPLETION_BADGE_CLASS[tone]}>
        {completionLabel}
      </Badge>
    </span>
  );
}
