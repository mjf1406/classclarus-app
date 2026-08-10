import { useTranslation } from "react-i18next";

import { SeatChartViolationsAlert } from "@/components/assigners/SeatChartViolationsList";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeatChartStudentHistory } from "@/hooks/assigners/useSeatChartStudentHistory";
import type { SeatChartPlacementHistoryFilter } from "@/hooks/assigners/useSeatChartStudentSummary";
import { useSeatChartStudentSummary } from "@/hooks/assigners/useSeatChartStudentSummary";
import { formatLocalizedSeatChartHistoryDate } from "@/i18n/formatDate";
import type {
  SeatChartAssignment,
  SeatChartStudentSummary,
  SeatChartViolation,
} from "@/lib/assigners/seatCharts";
import type { Id } from "../../../convex/_generated/dataModel";

type SeatChartStudentInspectorProps = {
  classId: Id<"classes">;
  chartId: Id<"seatCharts">;
  studentUserId: Id<"users">;
  studentName: string;
  assignments: Array<SeatChartAssignment>;
  violations?: Array<SeatChartViolation>;
};

function StatRow({
  label,
  count,
  total,
  percent,
  t,
}: {
  label: string;
  count: number;
  total?: number;
  percent: number;
  t: (key: string, options?: Record<string, string | number>) => string;
}) {
  const value =
    total !== undefined
      ? t("chartContextStatFraction", { count, total, percent })
      : t("chartContextStatPercent", { count, percent });

  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="truncate text-muted-foreground">{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}

function placementFilterFromDraft(
  draft: NonNullable<SeatChartStudentSummary["draftPlacement"]>,
): SeatChartPlacementHistoryFilter {
  return {
    deskItemId: draft.deskItemId,
    ...(draft.zoneName !== undefined ? { zoneName: draft.zoneName } : {}),
    ...(draft.teamKey !== undefined ? { teamKey: draft.teamKey } : {}),
  };
}

function formatDraftPlacement(
  draft: NonNullable<SeatChartStudentSummary["draftPlacement"]>,
  t: (key: string, options?: Record<string, string | number>) => string,
): string {
  return [
    draft.deskNumber !== undefined ? t("chartCurrentSeat", { seat: draft.deskNumber }) : null,
    draft.zoneName,
    draft.teamLabel,
    draft.neighborDisplayNames.length > 0 ? draft.neighborDisplayNames.join(", ") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function SeatChartStudentInspector({
  classId,
  chartId,
  studentUserId,
  studentName,
  assignments,
  violations = [],
}: SeatChartStudentInspectorProps) {
  const { t } = useTranslation("assigners");
  const summaryQuery = useSeatChartStudentSummary(classId, chartId, studentUserId, assignments);
  const placementFilter = summaryQuery.data?.draftPlacement
    ? placementFilterFromDraft(summaryQuery.data.draftPlacement)
    : null;
  const historyQuery = useSeatChartStudentHistory(classId, chartId, studentUserId, placementFilter);

  if (summaryQuery.isPending) {
    return <Skeleton className="h-32 w-full rounded-xl" />;
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t("chartInspectorLoadFailed")}</AlertTitle>
      </Alert>
    );
  }

  const summary = summaryQuery.data;
  const historyItems = historyQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const placementStats = [
    summary.currentContextCounts.seat,
    summary.currentContextCounts.zone,
    summary.currentContextCounts.team,
  ].filter((row): row is NonNullable<typeof row> => row !== undefined);
  const combinationStat = summary.currentContextCounts.combination;

  return (
    <Card size="sm" className="flex max-h-full flex-col overflow-hidden">
      <CardHeader className="border-b py-3">
        <CardTitle className="text-sm">{studentName}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 overflow-y-auto p-3">
        {violations.length > 0 ? (
          <SeatChartViolationsAlert
            violations={violations}
            title={t("chartViolationStudentTitle")}
          />
        ) : null}

        {!summary.draftPlacement ? (
          <p className="text-xs text-muted-foreground">{t("chartInspectorUnseated")}</p>
        ) : (
          <>
            <div className="flex flex-col gap-0.5">
              <p className="text-xs font-medium">
                {formatDraftPlacement(summary.draftPlacement, t)}
              </p>
              <p className="text-[11px] text-muted-foreground">{t("chartDraftPlacementNote")}</p>
            </div>

            {placementStats.length > 0 || combinationStat !== undefined ? (
              <div className="flex flex-col gap-1">
                <div className="text-xs font-medium">{t("chartCurrentContextTitle")}</div>
                {placementStats.map((row) => (
                  <StatRow
                    key={row.label}
                    label={row.label}
                    count={row.count}
                    total={summary.totalRecorded}
                    percent={row.percent}
                    t={t}
                  />
                ))}
                {combinationStat !== undefined ? (
                  <StatRow
                    key={combinationStat.label}
                    label={combinationStat.label}
                    count={combinationStat.count}
                    percent={combinationStat.percent}
                    t={t}
                  />
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col gap-1">
              <div className="text-xs font-medium">{t("chartHistoryTitle")}</div>
              {historyQuery.isPending ? (
                <Skeleton className="h-8 w-full rounded-md" />
              ) : historyItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("chartHistoryEmpty")}</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {historyItems.map((item) => (
                    <li
                      key={`${item.recordId}-${item.recordedAt}`}
                      className="text-xs text-muted-foreground"
                    >
                      {formatLocalizedSeatChartHistoryDate(item.recordedAt)}
                    </li>
                  ))}
                </ul>
              )}
              {historyQuery.hasNextPage ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={historyQuery.isFetchingNextPage}
                  onClick={() => void historyQuery.fetchNextPage()}
                >
                  {t("chartHistoryLoadMore")}
                </Button>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
