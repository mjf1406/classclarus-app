import { useTranslation } from "react-i18next";

import { SeatChartViolationsAlert } from "@/components/assigners/SeatChartViolationsList";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeatChartStudentHistory } from "@/hooks/assigners/useSeatChartStudentHistory";
import { useSeatChartStudentSummary } from "@/hooks/assigners/useSeatChartStudentSummary";
import { formatLocalizedDateTime } from "@/i18n/formatDate";
import type { SeatChartViolation } from "@/lib/assigners/seatCharts";
import type { Id } from "../../../convex/_generated/dataModel";

type SeatChartStudentInspectorProps = {
  classId: Id<"classes">;
  chartId: Id<"seatCharts">;
  studentUserId: Id<"users">;
  studentName: string;
  violations?: Array<SeatChartViolation>;
  onOpenRecord?: (recordId: Id<"seatChartRecords">) => void;
};

function StatRow({ label, count, percent }: { label: string; count: number; percent: number }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="truncate">{label}</span>
      <span className="shrink-0 tabular-nums text-muted-foreground">
        {count} ({percent}%)
      </span>
    </div>
  );
}

export function SeatChartStudentInspector({
  classId,
  chartId,
  studentUserId,
  studentName,
  violations = [],
  onOpenRecord,
}: SeatChartStudentInspectorProps) {
  const { t } = useTranslation("assigners");
  const summaryQuery = useSeatChartStudentSummary(classId, chartId, studentUserId);
  const historyQuery = useSeatChartStudentHistory(classId, chartId, studentUserId);

  if (summaryQuery.isPending) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
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

  return (
    <Card size="sm" className="flex max-h-full flex-col overflow-hidden">
      <CardHeader className="border-b">
        <CardTitle className="text-base">{studentName}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 overflow-y-auto p-4">
        {violations.length > 0 ? (
          <SeatChartViolationsAlert
            violations={violations}
            title={t("chartViolationStudentTitle")}
          />
        ) : null}

        {summary.draftPlacement ? (
          <Alert>
            <AlertTitle>{t("chartDraftPlacementTitle")}</AlertTitle>
            <AlertDescription className="flex flex-col gap-1">
              <span>{t("chartDraftPlacementNote")}</span>
              <span>
                {[
                  summary.draftPlacement.deskNumber !== undefined
                    ? t("chartCurrentSeat", { seat: summary.draftPlacement.deskNumber })
                    : null,
                  summary.draftPlacement.zoneName,
                  summary.draftPlacement.teamLabel,
                  summary.draftPlacement.neighborDisplayNames.length > 0
                    ? summary.draftPlacement.neighborDisplayNames.join(", ")
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium">{t("chartRecordedTotal")}</div>
          <Badge variant="secondary">{summary.totalRecorded}</Badge>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium">{t("chartCurrentContextTitle")}</div>
          {summary.currentContextCounts.seat ? (
            <StatRow
              label={summary.currentContextCounts.seat.label}
              count={summary.currentContextCounts.seat.count}
              percent={summary.currentContextCounts.seat.percent}
            />
          ) : null}
          {summary.currentContextCounts.zone ? (
            <StatRow
              label={summary.currentContextCounts.zone.label}
              count={summary.currentContextCounts.zone.count}
              percent={summary.currentContextCounts.zone.percent}
            />
          ) : null}
          {summary.currentContextCounts.team ? (
            <StatRow
              label={summary.currentContextCounts.team.label}
              count={summary.currentContextCounts.team.count}
              percent={summary.currentContextCounts.team.percent}
            />
          ) : null}
          {summary.currentContextCounts.combination ? (
            <StatRow
              label={summary.currentContextCounts.combination.label}
              count={summary.currentContextCounts.combination.count}
              percent={summary.currentContextCounts.combination.percent}
            />
          ) : null}
          {summary.currentContextCounts.neighbors.map((neighbor) => (
            <StatRow
              key={neighbor.studentUserId}
              label={t("chartNeighborStat", { name: neighbor.label })}
              count={neighbor.count}
              percent={neighbor.percent}
            />
          ))}
        </div>

        <Separator />

        <BreakdownSection
          title={t("chartBreakdownSeats")}
          rows={summary.breakdowns.seats}
          empty={t("chartBreakdownEmpty")}
        />
        <BreakdownSection
          title={t("chartBreakdownZones")}
          rows={summary.breakdowns.zones}
          empty={t("chartBreakdownEmpty")}
        />
        <BreakdownSection
          title={t("chartBreakdownTeams")}
          rows={summary.breakdowns.teams}
          empty={t("chartBreakdownEmpty")}
        />
        <BreakdownSection
          title={t("chartBreakdownNeighbors")}
          rows={summary.breakdowns.neighbors}
          empty={t("chartBreakdownEmpty")}
        />

        <Separator />

        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium">{t("chartHistoryTitle")}</div>
          {historyItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("chartHistoryEmpty")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {historyItems.map((item) => (
                <li key={`${item.recordId}-${item.recordedAt}`}>
                  <button
                    type="button"
                    className="w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-accent/40"
                    onClick={() => onOpenRecord?.(item.recordId)}
                  >
                    <div className="font-medium">{formatLocalizedDateTime(item.recordedAt)}</div>
                    <div className="text-muted-foreground">{item.combinationLabel}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {historyQuery.hasNextPage ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={historyQuery.isFetchingNextPage}
              onClick={() => void historyQuery.fetchNextPage()}
            >
              {t("chartHistoryLoadMore")}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function BreakdownSection({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ label: string; count: number }>;
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <div className="text-sm font-medium">{title}</div>
        <p className="text-sm text-muted-foreground">{empty}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="text-sm font-medium">{title}</div>
      {rows.slice(0, 5).map((row) => (
        <StatRow key={`${title}-${row.label}`} label={row.label} count={row.count} percent={0} />
      ))}
    </div>
  );
}
