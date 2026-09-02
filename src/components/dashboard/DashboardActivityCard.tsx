import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { DashboardSectionCard } from "@/components/dashboard/DashboardSectionCard";
import { useRecentClassActivity } from "@/hooks/activity/useRecentClassActivity";
import { useLogClassAccessOnce } from "@/hooks/activity/useLogClassAccess";
import { formatLocalizedDateTime } from "@/i18n/formatDate";
import { formatActivitySummary } from "@/lib/activity/formatActivitySummary";
import type { Id } from "../../../convex/_generated/dataModel";

type DashboardActivityCardProps = {
  classId: Id<"classes">;
};

export function DashboardActivityCard({ classId }: DashboardActivityCardProps) {
  const { t } = useTranslation("classes");
  const query = useRecentClassActivity(classId);
  const events = query.data?.page ?? [];
  const empty = !query.isPending && !query.isError && events.length === 0;

  const accessArgs = useMemo(
    () => ({
      classId,
      resourceType: "activity",
      summary: "Viewed activity log",
      summaryKey: "activitySummary_viewedActivityLog",
    }),
    [classId],
  );
  useLogClassAccessOnce(!query.isPending, accessArgs);

  return (
    <DashboardSectionCard
      title={t("dashboardActivityTitle")}
      viewAllLabel={t("dashboardViewAll")}
      viewAllTo="/class/$classId/activity"
      viewAllParams={{ classId }}
      isPending={query.isPending}
      isError={query.isError}
      errorTitle={t("dashboardLoadFailed")}
      errorDescription={t("dashboardLoadFailedDescription")}
      onRetry={() => void query.refetch()}
      empty={empty}
      emptyTitle={t("dashboardActivityEmptyTitle")}
      emptyDescription={t("dashboardActivityEmptyDescription")}
    >
      {events.map((event) => (
        <Link
          key={event._id}
          to="/class/$classId/activity"
          params={{ classId }}
          className="flex flex-col gap-1 rounded-xl border px-3 py-2 transition-colors hover:bg-accent/40"
        >
          <span className="text-sm font-medium">{formatActivitySummary(event, t)}</span>
          <span className="text-xs text-muted-foreground">
            {formatLocalizedDateTime(event.createdAt)}
          </span>
        </Link>
      ))}
    </DashboardSectionCard>
  );
}
