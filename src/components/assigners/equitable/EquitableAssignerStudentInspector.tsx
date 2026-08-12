import { useTranslation } from "react-i18next";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEquitableStudentHistory } from "@/hooks/assigners/equitable/useEquitableStudentHistory";
import { useEquitableStudentSummary } from "@/hooks/assigners/equitable/useEquitableStudentSummary";
import { formatLocalizedSeatChartHistoryDate } from "@/i18n/formatDate";
import type { EquitableAssignerScope } from "@/lib/assigners/equitableAssigners";
import type { Id } from "../../../../convex/_generated/dataModel";

type EquitableAssignerStudentInspectorProps = {
  classId: Id<"classes">;
  assignerId: Id<"equitableAssigners">;
  studentUserId: Id<"users">;
  studentName: string;
  scope: EquitableAssignerScope;
  balanceGender: boolean;
  draftSlotId?: string | null;
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

export function EquitableAssignerStudentInspector({
  classId,
  assignerId,
  studentUserId,
  studentName,
  scope,
  balanceGender,
  draftSlotId,
}: EquitableAssignerStudentInspectorProps) {
  const { t } = useTranslation("assigners");
  const summaryQuery = useEquitableStudentSummary(
    classId,
    assignerId,
    studentUserId,
    scope,
    balanceGender,
    draftSlotId,
  );

  const placementFilter =
    summaryQuery.data?.draftItem !== undefined
      ? {
          item: summaryQuery.data.draftItem,
          ...(summaryQuery.data.draftGroupName !== undefined
            ? { groupName: summaryQuery.data.draftGroupName }
            : {}),
        }
      : null;

  const historyQuery = useEquitableStudentHistory(
    classId,
    assignerId,
    studentUserId,
    placementFilter,
  );

  if (summaryQuery.isPending) {
    return <Skeleton className="h-32 w-full rounded-xl" />;
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t("equitableInspectorLoadFailed")}</AlertTitle>
      </Alert>
    );
  }

  const summary = summaryQuery.data;
  const historyItems = historyQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Card size="sm" className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="shrink-0 border-b py-3">
        <CardTitle className="text-sm">{studentName}</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        <div className="text-xs text-muted-foreground">
          {t("equitableInspectorTotalRecorded", { count: summary.totalRecorded })}
        </div>

        {!draftSlotId ? (
          <p className="text-xs text-muted-foreground">{t("equitableInspectorUnassigned")}</p>
        ) : null}

        {summary.currentItem || summary.currentGroup ? (
          <div className="flex flex-col gap-1">
            <div className="text-xs font-medium">{t("equitableInspectorCurrentTitle")}</div>
            {summary.currentItem ? (
              <StatRow
                label={summary.currentItem.label}
                count={summary.currentItem.count}
                total={summary.totalRecorded}
                percent={summary.currentItem.percent}
                t={t}
              />
            ) : null}
            {summary.currentGroup ? (
              <StatRow
                label={summary.currentGroup.label}
                count={summary.currentGroup.count}
                total={summary.totalRecorded}
                percent={summary.currentGroup.percent}
                t={t}
              />
            ) : null}
          </div>
        ) : null}

        {summary.itemBreakdown.length > 0 ? (
          <div className="flex flex-col gap-1">
            <div className="text-xs font-medium">{t("equitableInspectorBreakdownTitle")}</div>
            {summary.itemBreakdown.map((row: { label: string; count: number; percent: number }) => (
              <StatRow
                key={row.label}
                label={row.label}
                count={row.count}
                total={summary.totalRecorded}
                percent={row.percent}
                t={t}
              />
            ))}
          </div>
        ) : null}

        {placementFilter ? (
          <div className="flex flex-col gap-1">
            <div className="text-xs font-medium">{t("equitableInspectorHistoryTitle")}</div>
            {historyQuery.isPending ? (
              <Skeleton className="h-8 w-full rounded-md" />
            ) : historyItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("equitableInspectorHistoryEmpty")}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {historyItems.map((item) => (
                  <li key={`${item.runId}-${item.ranAt}`} className="text-xs text-muted-foreground">
                    {formatLocalizedSeatChartHistoryDate(item.ranAt)}
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
        ) : null}
      </CardContent>
    </Card>
  );
}
