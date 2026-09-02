import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { DashboardSectionCard } from "@/components/dashboard/DashboardSectionCard";
import { useRazInitialLevels } from "@/hooks/raz/useRazInitialLevels";
import { useStudentRoster } from "@/hooks/roster/useStudentRoster";
import { DASHBOARD_RAZ_LIMIT } from "@/lib/dashboard/dashboard";
import {
  getRazAssessmentSchedule,
  getRazDisplayStatuses,
  type RazDisplayStatus,
} from "@/lib/raz/assessmentSchedule";
import { RAZ_STATUS_I18N_KEY, razStatusBadgeVariant } from "@/lib/raz/razSummaryPresentation";
import { getRosterDisplayName, type RosterNameFormat } from "@/lib/roster/roster";
import type { Id } from "../../../convex/_generated/dataModel";

const DUE_STATUS_RANK: Record<string, number> = {
  overdue: 0,
  rti: 1,
  due_now: 2,
  coming_soon: 3,
};

type DashboardRazDueCardProps = {
  classId: Id<"classes">;
  nameFormat: RosterNameFormat;
};

export function DashboardRazDueCard({ classId, nameFormat }: DashboardRazDueCardProps) {
  const { t } = useTranslation("classes");
  const { t: tRaz } = useTranslation("raz");
  const levelsQuery = useRazInitialLevels(classId);
  const rosterQuery = useStudentRoster(classId);
  const nowMs = useMemo(() => Date.now(), []);

  const rows = useMemo(() => {
    const rosterById = new Map(
      (rosterQuery.data ?? []).map((student) => [student.userId, student]),
    );
    return (levelsQuery.data ?? [])
      .flatMap((row) => {
        const statuses = getRazDisplayStatuses({
          level: row.currentLevel,
          scheduleAnchorAt: row.scheduleAnchorAt,
          lastAssessedAt: row.lastAssessedAt,
          manualStatus: row.manualStatus,
          nowMs,
        });
        const dueStatus = statuses.find(
          (status) =>
            status === "overdue" ||
            status === "due_now" ||
            status === "coming_soon" ||
            status === "rti",
        );
        if (!dueStatus) return [];
        const schedule = getRazAssessmentSchedule(
          row.currentLevel,
          row.scheduleAnchorAt,
          nowMs,
          row.lastAssessedAt,
          { forceOverdue: row.manualStatus === "rti" },
        );
        const student = rosterById.get(row.studentUserId);
        return [
          {
            studentUserId: row.studentUserId,
            statuses,
            dueStatus,
            daysUntilDue: schedule?.daysUntilDue ?? 0,
            name: student
              ? getRosterDisplayName(student, t("unnamedMember"), nameFormat)
              : t("unnamedMember"),
          },
        ];
      })
      .sort((a, b) => {
        const rankA = DUE_STATUS_RANK[a.dueStatus] ?? 9;
        const rankB = DUE_STATUS_RANK[b.dueStatus] ?? 9;
        if (rankA !== rankB) return rankA - rankB;
        return a.daysUntilDue - b.daysUntilDue;
      })
      .slice(0, DASHBOARD_RAZ_LIMIT);
  }, [levelsQuery.data, nameFormat, nowMs, rosterQuery.data, t]);

  const isPending = levelsQuery.isPending || rosterQuery.isPending;
  const isError = levelsQuery.isError || rosterQuery.isError;
  const empty = !isPending && !isError && rows.length === 0;

  return (
    <DashboardSectionCard
      title={t("dashboardRazDueTitle")}
      viewAllLabel={t("dashboardViewAll")}
      viewAllTo="/class/$classId/raz"
      viewAllParams={{ classId }}
      isPending={isPending}
      isError={isError}
      errorTitle={t("dashboardLoadFailed")}
      errorDescription={t("dashboardLoadFailedDescription")}
      onRetry={() => {
        void levelsQuery.refetch();
        void rosterQuery.refetch();
      }}
      empty={empty}
      emptyTitle={t("dashboardRazDueEmptyTitle")}
      emptyDescription={t("dashboardRazDueEmptyDescription")}
    >
      {rows.map((row) => (
        <Link
          key={row.studentUserId}
          to="/class/$classId/raz"
          params={{ classId }}
          className="flex items-start justify-between gap-2 rounded-xl border px-3 py-2 transition-colors hover:bg-accent/40"
        >
          <span className="truncate text-sm font-medium">{row.name}</span>
          <span className="inline-flex flex-wrap justify-end gap-1">
            {row.statuses
              .filter((status): status is RazDisplayStatus => status in RAZ_STATUS_I18N_KEY)
              .map((status) => (
                <Badge key={status} variant={razStatusBadgeVariant(status)}>
                  {tRaz(RAZ_STATUS_I18N_KEY[status])}
                </Badge>
              ))}
          </span>
        </Link>
      ))}
    </DashboardSectionCard>
  );
}
