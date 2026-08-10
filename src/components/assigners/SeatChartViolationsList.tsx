import { TriangleAlertIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ViolationConstraintKindBadge } from "@/components/assigners/SeatConstraintKind";
import type { SeatChartViolation } from "@/lib/assigners/seatCharts";
import { violationBrokenLabel } from "@/lib/assigners/seatConstraints";

function violationReasonKey(violation: SeatChartViolation): string {
  return `chartViolationReason_${violation.type}_${violation.polarity}`;
}

type SeatChartViolationsListProps = {
  violations: Array<SeatChartViolation>;
  className?: string;
};

export function SeatChartViolationsList({ violations, className }: SeatChartViolationsListProps) {
  const { t } = useTranslation("assigners");

  if (violations.length === 0) return null;

  return (
    <ul className={className ?? "flex flex-col gap-3"}>
      {violations.map((violation) => (
        <li key={violation.constraintId} className="flex flex-col gap-0.5">
          <ViolationConstraintKindBadge
            type={violation.type}
            label={violationBrokenLabel(violation.type, t)}
          />
          <span className="pl-7 text-sm font-medium text-foreground">{violation.summary}</span>
          <span className="pl-7 text-xs text-muted-foreground">
            {t(violationReasonKey(violation))}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SeatChartViolationsAlert({
  violations,
  title,
}: {
  violations: Array<SeatChartViolation>;
  title?: string;
}) {
  const { t } = useTranslation("assigners");

  if (violations.length === 0) return null;

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3"
      role="alert"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-destructive">
        <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
        {title ?? t("chartViolationsTitle")}
      </div>
      <SeatChartViolationsList violations={violations} />
    </div>
  );
}
