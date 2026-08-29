import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

import { getRazAssessmentSchedule, getRazDisplayStatuses } from "@/lib/raz/assessmentSchedule";
import {
  formatRazMediumDate,
  formatRazMediumDateTime,
  RAZ_STATUS_I18N_KEY,
  razStatusBadgeVariant,
} from "@/lib/raz/razSummaryPresentation";
import type { useRazForAudience } from "@/hooks/raz/useRazForAudience";

export type RazSummaryStudent = NonNullable<ReturnType<typeof useRazForAudience>["data"]>[number];

type RazSummaryContentProps = {
  student: RazSummaryStudent;
  language: string;
  compact?: boolean;
};

export function RazSummaryContent({ student, language, compact = false }: RazSummaryContentProps) {
  const { t } = useTranslation("raz");

  const schedule =
    student.currentLevel != null &&
    student.scheduleAnchorAt != null &&
    student.manualStatus !== "ineligible"
      ? getRazAssessmentSchedule(
          student.currentLevel,
          student.scheduleAnchorAt,
          Date.now(),
          student.lastAssessedAt,
          { forceOverdue: student.manualStatus === "rti" },
        )
      : null;

  const statuses =
    student.currentLevel != null && student.scheduleAnchorAt != null
      ? getRazDisplayStatuses({
          level: student.currentLevel,
          scheduleAnchorAt: student.scheduleAnchorAt,
          lastAssessedAt: student.lastAssessedAt,
          manualStatus: student.manualStatus,
        })
      : [];

  const dueRelative =
    schedule == null
      ? null
      : schedule.daysUntilDue < 0
        ? t("dueOverdueDays", { count: Math.abs(schedule.daysUntilDue) })
        : schedule.daysUntilDue === 0
          ? t("dueToday")
          : t("dueInDays", { count: schedule.daysUntilDue });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{t("columnCurrentLevel")}</span>
        <span
          className={
            compact
              ? "text-2xl font-semibold tabular-nums tracking-tight"
              : "text-lg font-semibold tabular-nums"
          }
        >
          {student.currentLevel ?? t("levelUnset")}
        </span>
      </div>

      {statuses.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {statuses.map((status) => (
            <Badge key={status} variant={razStatusBadgeVariant(status)}>
              {t(RAZ_STATUS_I18N_KEY[status])}
            </Badge>
          ))}
        </div>
      ) : null}

      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">{t("lastAssessedLabel")}</dt>
          <dd className="font-medium tabular-nums">
            {student.lastAssessedAt != null
              ? formatRazMediumDateTime(student.lastAssessedAt, language)
              : t("neverAssessed")}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">{t("columnNextDue")}</dt>
          <dd className="flex flex-col gap-0.5">
            {student.manualStatus === "ineligible" ? (
              <span className="font-medium text-muted-foreground">{t("dueIneligible")}</span>
            ) : dueRelative != null && schedule != null ? (
              <>
                <span className="font-medium">{dueRelative}</span>
                {!compact ? (
                  <>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t("dueWindowDates", {
                        start: formatRazMediumDate(schedule.windowStartAt, language),
                        end: formatRazMediumDate(schedule.windowEndAt, language),
                      })}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t("dueRangeDays", {
                        lower: schedule.lowerBoundDays,
                        upper: schedule.upperBoundDays,
                      })}
                    </span>
                  </>
                ) : null}
              </>
            ) : (
              <span className="font-medium text-muted-foreground">{t("dueUnavailable")}</span>
            )}
          </dd>
        </div>
      </dl>

      {!compact ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm text-muted-foreground">{t("resultMixLabel")}</p>
          {student.assessmentCount === 0 ? (
            <p className="text-sm text-muted-foreground">{t("resultMixEmpty")}</p>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
              <span>
                {t("resultLevelUp")}: {student.levelUpPct}%
              </span>
              <span>
                {t("resultStay")}: {student.stayPct}%
              </span>
              <span>
                {t("resultLevelDown")}: {student.levelDownPct}%
              </span>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
