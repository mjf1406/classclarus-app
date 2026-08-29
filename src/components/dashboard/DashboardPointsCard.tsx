import { useMemo } from "react";
import { AwardIcon, FlagIcon, GiftIcon, TriangleAlertIcon, TrophyIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { DashboardSectionCard } from "@/components/dashboard/DashboardSectionCard";
import { usePointsForAudience } from "@/hooks/points/usePointsForAudience";
import { localDateKey } from "@/lib/attendance/dateKey";
import { getRosterDisplayName, type RosterNameFormat } from "@/lib/roster/roster";
import type { Id } from "../../../convex/_generated/dataModel";

type DashboardPointsCardProps = {
  classId: Id<"classes">;
  studentUserId: Id<"users"> | null;
  nameFormat: RosterNameFormat;
  audiencePending: boolean;
};

export function DashboardPointsCard({
  classId,
  studentUserId,
  nameFormat,
  audiencePending,
}: DashboardPointsCardProps) {
  const { t } = useTranslation("classes");
  const { t: tPoints } = useTranslation("points");
  const dateKey = useMemo(() => localDateKey(), []);
  const query = usePointsForAudience(classId, dateKey);
  const student = useMemo(
    () => (query.data ?? []).find((row) => row.userId === studentUserId) ?? null,
    [query.data, studentUserId],
  );
  const isPending = audiencePending || query.isPending;
  const empty = !isPending && !query.isError && !student;

  const displayName = student
    ? getRosterDisplayName(student, t("unnamedMember"), nameFormat)
    : null;

  return (
    <DashboardSectionCard
      title={t("dashboardPointsTitle")}
      viewAllLabel={t("dashboardViewAll")}
      viewAllTo="/class/$classId/points"
      viewAllParams={{ classId }}
      isPending={isPending}
      isError={query.isError}
      errorTitle={t("dashboardLoadFailed")}
      errorDescription={t("dashboardLoadFailedDescription")}
      onRetry={() => void query.refetch()}
      empty={empty}
      emptyTitle={t("dashboardNoPointsTitle")}
      emptyDescription={t("dashboardNoPointsDescription")}
    >
      {student ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-muted-foreground">{displayName}</p>
            {student.warningCount > 0 || student.minusCount > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-2">
                {student.warningCount > 0 ? (
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <TriangleAlertIcon className="size-4" aria-hidden />
                    <span className="text-sm font-semibold tabular-nums">
                      {student.warningCount}
                    </span>
                    <span className="sr-only">
                      {tPoints("warningsCount", { count: student.warningCount })}
                    </span>
                  </span>
                ) : null}
                {student.minusCount > 0 ? (
                  <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                    <FlagIcon className="size-4" aria-hidden />
                    <span className="text-sm font-semibold tabular-nums">{student.minusCount}</span>
                    <span className="sr-only">
                      {tPoints("minusCount", { count: student.minusCount })}
                    </span>
                  </span>
                ) : null}
              </span>
            ) : null}
          </div>

          <div
            className="flex items-center gap-2 text-2xl font-semibold tabular-nums tracking-tight"
            aria-label={tPoints("statBalanceAria", { count: student.pointsBalance })}
          >
            <TrophyIcon className="size-6 shrink-0 text-amber-400" aria-hidden />
            <span>{tPoints("pointsBalance", { count: student.pointsBalance })}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm tabular-nums text-muted-foreground">
            <span
              className="inline-flex items-center gap-1.5"
              aria-label={tPoints("statAwardedAria", { count: student.pointsAwarded })}
            >
              <AwardIcon className="size-4 shrink-0 text-amber-500/90" aria-hidden />
              <span className="text-muted-foreground">{t("dashboardPointsAwarded")}</span>
              <span className="font-medium text-foreground">{student.pointsAwarded}</span>
            </span>
            <span
              className="inline-flex items-center gap-1.5"
              aria-label={tPoints("statRemovedAria", { count: student.pointsRemoved })}
            >
              <FlagIcon className="size-4 shrink-0 text-rose-500/90" aria-hidden />
              <span className="text-muted-foreground">{t("dashboardPointsRemoved")}</span>
              <span className="font-medium text-foreground">
                {student.pointsRemoved === 0 ? 0 : -student.pointsRemoved}
              </span>
            </span>
            <span
              className="inline-flex items-center gap-1.5"
              aria-label={tPoints("statRedeemedAria", { count: student.pointsRedeemed })}
            >
              <GiftIcon className="size-4 shrink-0 text-emerald-500/90" aria-hidden />
              <span className="text-muted-foreground">{t("dashboardPointsRedeemed")}</span>
              <span className="font-medium text-foreground">{student.pointsRedeemed}</span>
            </span>
          </div>
        </div>
      ) : null}
    </DashboardSectionCard>
  );
}
