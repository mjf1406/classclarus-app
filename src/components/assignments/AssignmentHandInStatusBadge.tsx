import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { TASK_COMPLETION_BADGE_CLASS, completionTone } from "@/components/tasks/taskCompletionTone";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AssignmentHandInStatusBadgeProps = {
  handedIn?: boolean;
  pastDue?: boolean;
  showHandIn?: boolean;
  className?: string;
};

export function AssignmentHandInStatusBadge({
  handedIn = false,
  pastDue = false,
  showHandIn = true,
  className,
}: AssignmentHandInStatusBadgeProps) {
  const { t } = useTranslation("assignments");
  const tone = completionTone(handedIn, pastDue);
  const showLate = pastDue && !handedIn;

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      {showLate ? (
        <Badge variant="outline" className={TASK_COMPLETION_BADGE_CLASS.late}>
          {t("statusLate")}
        </Badge>
      ) : null}
      {showHandIn ? (
        <Badge variant="outline" className={cn("gap-1", TASK_COMPLETION_BADGE_CLASS[tone])}>
          {handedIn ? <CheckCircle2 className="size-3.5" aria-hidden /> : null}
          {handedIn ? t("linksHandedIn") : t("linksNotHandedIn")}
        </Badge>
      ) : null}
    </span>
  );
}
