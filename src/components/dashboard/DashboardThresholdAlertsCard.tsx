import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { DashboardSectionCard } from "@/components/dashboard/DashboardSectionCard";
import { usePointsBoard } from "@/hooks/points/usePointsBoard";
import { localDateKey } from "@/lib/attendance/dateKey";
import { DASHBOARD_THRESHOLD_LIMIT } from "@/lib/dashboard/dashboard";
import { studentsAtThresholds } from "@/lib/points/thresholdAlerts";
import { getRosterDisplayName, type RosterNameFormat } from "@/lib/roster/roster";
import type { Id } from "../../../convex/_generated/dataModel";

type DashboardThresholdAlertsCardProps = {
  classId: Id<"classes">;
  nameFormat: RosterNameFormat;
  warningAlerts: Array<{ count: number; action: string }>;
  minusAlerts: Array<{ count: number; action: string }>;
  classPending: boolean;
};

export function DashboardThresholdAlertsCard({
  classId,
  nameFormat,
  warningAlerts,
  minusAlerts,
  classPending,
}: DashboardThresholdAlertsCardProps) {
  const { t } = useTranslation("classes");
  const dateKey = useMemo(() => localDateKey(), []);
  const query = usePointsBoard(classId, dateKey);
  const hasAlerts = warningAlerts.length > 0 || minusAlerts.length > 0;
  const hits = useMemo(() => {
    if (!hasAlerts) return [];
    return studentsAtThresholds(query.data ?? [], warningAlerts, minusAlerts).slice(
      0,
      DASHBOARD_THRESHOLD_LIMIT,
    );
  }, [hasAlerts, minusAlerts, query.data, warningAlerts]);
  const studentsById = useMemo(() => {
    return new Map((query.data ?? []).map((student) => [student.userId, student]));
  }, [query.data]);
  const isPending = classPending || query.isPending;
  const empty = !isPending && !query.isError && hits.length === 0;

  return (
    <DashboardSectionCard
      title={t("dashboardThresholdsTitle")}
      viewAllLabel={t("dashboardViewAll")}
      viewAllTo="/class/$classId/points"
      viewAllParams={{ classId }}
      isPending={isPending}
      isError={query.isError}
      errorTitle={t("dashboardLoadFailed")}
      errorDescription={t("dashboardLoadFailedDescription")}
      onRetry={() => void query.refetch()}
      empty={empty}
      emptyTitle={t("dashboardThresholdsEmptyTitle")}
      emptyDescription={
        hasAlerts
          ? t("dashboardThresholdsEmptyDescription")
          : t("dashboardThresholdsNoAlertsDescription")
      }
    >
      {hits.map((hit) => {
        const student = studentsById.get(hit.userId as Id<"users">);
        const name = student
          ? getRosterDisplayName(student, t("unnamedMember"), nameFormat)
          : t("unnamedMember");
        return (
          <Link
            key={`${hit.userId}-${hit.metric}`}
            to="/class/$classId/points"
            params={{ classId }}
            className="flex items-start justify-between gap-2 rounded-xl border px-3 py-2 transition-colors hover:bg-accent/40"
          >
            <span className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-sm font-medium">{name}</span>
              <span className="text-xs text-muted-foreground">{hit.action}</span>
            </span>
            <Badge variant={hit.metric === "minus" ? "destructive" : "secondary"}>
              {hit.metric === "warning"
                ? t("dashboardThresholdWarning", { count: hit.count })
                : t("dashboardThresholdMinus", { count: hit.count })}
            </Badge>
          </Link>
        );
      })}
    </DashboardSectionCard>
  );
}
