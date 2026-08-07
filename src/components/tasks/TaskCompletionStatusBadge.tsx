import { useTranslation } from "react-i18next";

import { TASK_COMPLETION_BADGE_CLASS, completionTone } from "@/components/tasks/taskCompletionTone";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type TaskCompletionStatusBadgeProps = {
  completed: boolean;
  className?: string;
  /** Override label (e.g. "1 / 2 done" for multi-student personal cards). */
  label?: string;
};

export function TaskCompletionStatusBadge({
  completed,
  className,
  label,
}: TaskCompletionStatusBadgeProps) {
  const { t } = useTranslation("tasks");
  const tone = completionTone(completed);

  return (
    <Badge variant="outline" className={cn(TASK_COMPLETION_BADGE_CLASS[tone], className)}>
      {label ?? (completed ? t("statusDone") : t("statusNotDone"))}
    </Badge>
  );
}
