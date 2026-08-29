import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { DashboardSectionCard } from "@/components/dashboard/DashboardSectionCard";
import { useDashboardAssignerSnapshot } from "@/hooks/dashboard/useDashboardAssignerSnapshot";
import { formatLocalizedSeatChartHistoryDate } from "@/i18n/formatDate";
import type { Id } from "../../../convex/_generated/dataModel";

type DashboardAssignersCardProps = {
  classId: Id<"classes">;
  studentUserId: Id<"users"> | null;
  audiencePending: boolean;
};

function AssignerRow({
  label,
  value,
  detail,
  to,
  params,
}: {
  label: string;
  value: string;
  detail?: string;
  to: string;
  params: Record<string, string>;
}) {
  return (
    <Link
      to={to}
      params={params}
      className="flex flex-col gap-1 rounded-xl border px-3 py-2 transition-colors hover:bg-accent/40"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-semibold tabular-nums">{value}</span>
      </div>
      {detail ? <span className="text-xs text-muted-foreground">{detail}</span> : null}
    </Link>
  );
}

export function DashboardAssignersCard({
  classId,
  studentUserId,
  audiencePending,
}: DashboardAssignersCardProps) {
  const { t } = useTranslation("classes");
  const { t: tAssigners } = useTranslation("assigners");
  const query = useDashboardAssignerSnapshot(classId, studentUserId);
  const snapshot = query.data;
  const isPending = audiencePending || (studentUserId !== null && query.isPending);

  const hasSeat = snapshot?.seatCurrent != null;
  const hasAssignerRows = (snapshot?.assigners.length ?? 0) > 0;
  const empty = !isPending && !query.isError && !hasSeat && !hasAssignerRows;

  return (
    <DashboardSectionCard
      title={t("dashboardAssignersTitle")}
      viewAllLabel={t("dashboardViewAll")}
      viewAllTo="/class/$classId/assigners/random"
      viewAllParams={{ classId }}
      isPending={isPending}
      isError={query.isError}
      errorTitle={t("dashboardLoadFailed")}
      errorDescription={t("dashboardLoadFailedDescription")}
      onRetry={() => void query.refetch()}
      empty={empty}
      emptyTitle={t("dashboardNoAssignersTitle")}
      emptyDescription={t("dashboardNoAssignersDescription")}
    >
      {snapshot?.seatCurrent ? (
        <AssignerRow
          label={t("dashboardSeatTitle")}
          value={
            snapshot.seatCurrent.deskNumber !== undefined
              ? tAssigners("chartCurrentSeat", { seat: snapshot.seatCurrent.deskNumber })
              : t("dashboardNoSeatValue")
          }
          detail={`${snapshot.seatCurrent.layoutName} · ${snapshot.seatCurrent.chartName} · ${formatLocalizedSeatChartHistoryDate(snapshot.seatCurrent.recordedAt)}`}
          to="/class/$classId/assigners/seats/stats"
          params={{ classId }}
        />
      ) : null}

      {snapshot?.assigners.map((row) => {
        const to =
          row.kind === "random"
            ? "/class/$classId/assigners/random/$assignerId"
            : "/class/$classId/assigners/equitable/$assignerId";

        const value = row.assignment?.item ?? t("dashboardNoAssignment");
        const detailParts: string[] = [];
        if (row.assignment?.groupName) {
          detailParts.push(row.assignment.groupName);
        }
        if (row.assignment?.ranAt) {
          detailParts.push(formatLocalizedSeatChartHistoryDate(row.assignment.ranAt));
        } else if (row.latestRunAt === null) {
          detailParts.push(t("dashboardNoRunYet"));
        }

        return (
          <AssignerRow
            key={`${row.kind}:${row.assignerId}`}
            label={row.name}
            value={value}
            detail={detailParts.length > 0 ? detailParts.join(" · ") : undefined}
            to={to}
            params={{ classId, assignerId: row.assignerId }}
          />
        );
      })}
    </DashboardSectionCard>
  );
}
