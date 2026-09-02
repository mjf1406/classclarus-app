import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { DashboardSectionCard } from "@/components/dashboard/DashboardSectionCard";
import { useGradingSummary } from "@/hooks/assignments/useGradingSummary";
import { formatLocalizedDueDate } from "@/i18n/formatDate";
import { isAssignmentPastDue } from "@/lib/assignments/assignments";
import { DASHBOARD_GRADING_LIMIT } from "@/lib/dashboard/dashboard";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

type DashboardNeedsGradingCardProps = {
  classId: Id<"classes">;
};

export function DashboardNeedsGradingCard({ classId }: DashboardNeedsGradingCardProps) {
  const { t } = useTranslation("classes");
  const { t: tAssignments } = useTranslation("assignments");
  const query = useGradingSummary(classId);
  const items = (query.data ?? []).slice(0, DASHBOARD_GRADING_LIMIT);
  const empty = !query.isPending && !query.isError && items.length === 0;

  return (
    <DashboardSectionCard
      title={t("dashboardNeedsGradingTitle")}
      viewAllLabel={t("dashboardViewAll")}
      viewAllTo="/class/$classId/assignments"
      viewAllParams={{ classId }}
      isPending={query.isPending}
      isError={query.isError}
      errorTitle={t("dashboardLoadFailed")}
      errorDescription={t("dashboardLoadFailedDescription")}
      onRetry={() => void query.refetch()}
      empty={empty}
      emptyTitle={t("dashboardNeedsGradingEmptyTitle")}
      emptyDescription={t("dashboardNeedsGradingEmptyDescription")}
    >
      {items.map((assignment) => {
        const pastDue = isAssignmentPastDue(assignment.dueDateKey);
        return (
          <Link
            key={assignment._id}
            to="/class/$classId/assignments/$assignmentId/grade"
            params={{ classId, assignmentId: assignment._id }}
            className="flex flex-col gap-1 rounded-xl border px-3 py-2 transition-colors hover:bg-accent/40"
          >
            <span className="text-sm font-medium">{assignment.name}</span>
            <span className="text-xs text-muted-foreground">
              {t("dashboardNeedsGradingCount", {
                ungraded: assignment.ungradedCount,
                handedIn: assignment.handedInCount,
              })}
            </span>
            {assignment.dueDateKey ? (
              <span className={cn("text-xs text-muted-foreground", pastDue && "text-destructive")}>
                {tAssignments("dueDateValue", {
                  date: formatLocalizedDueDate(assignment.dueDateKey),
                })}
              </span>
            ) : null}
          </Link>
        );
      })}
    </DashboardSectionCard>
  );
}
