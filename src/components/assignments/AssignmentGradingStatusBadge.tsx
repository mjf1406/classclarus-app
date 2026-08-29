import { useTranslation } from "react-i18next";

import { TASK_COMPLETION_BADGE_CLASS } from "@/components/tasks/taskCompletionTone";
import { Badge } from "@/components/ui/badge";
import type { AssignmentGradingStatus } from "@/lib/assignments/assignments";
import { cn } from "@/lib/utils";

const TONE: Record<AssignmentGradingStatus, keyof typeof TASK_COMPLETION_BADGE_CLASS> = {
  notGraded: "notDone",
  gradedNotReleased: "late",
  released: "done",
};

const LABEL_KEY: Record<
  AssignmentGradingStatus,
  "statusNotGraded" | "statusGradedNotReleased" | "statusGradesReleased"
> = {
  notGraded: "statusNotGraded",
  gradedNotReleased: "statusGradedNotReleased",
  released: "statusGradesReleased",
};

type AssignmentGradingStatusBadgeProps = {
  status: AssignmentGradingStatus | undefined;
  className?: string;
};

export function AssignmentGradingStatusBadge({
  status,
  className,
}: AssignmentGradingStatusBadgeProps) {
  const { t } = useTranslation("assignments");
  if (!status) return null;
  return (
    <Badge variant="outline" className={cn(TASK_COMPLETION_BADGE_CLASS[TONE[status]], className)}>
      {t(LABEL_KEY[status])}
    </Badge>
  );
}
