import { Link, useNavigate } from "@tanstack/react-router";
import { Archive, LayoutGrid, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AssignersSeatsShell } from "@/components/assigners/AssignersSeatsShell";
import { SeatChartCreateCredenza } from "@/components/assigners/SeatChartCreateCredenza";
import { SeatChartNameCredenza } from "@/components/assigners/SeatChartNameCredenza";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useArchiveSeatChart } from "@/hooks/assigners/useArchiveSeatChart";
import { useCreateSeatChart } from "@/hooks/assigners/useCreateSeatChart";
import { useRenameSeatChart } from "@/hooks/assigners/useRenameSeatChart";
import { useSeatCharts } from "@/hooks/assigners/useSeatCharts";
import { useCan } from "@/hooks/permissions/useCan";
import { formatLocalizedDateTime } from "@/i18n/formatDate";
import {
  sortSeatCharts,
  type SeatChartListItem,
  type SeatChartSortDirection,
  type SeatChartSortKey,
} from "@/lib/assigners/seatCharts";
import type { Id } from "../../../convex/_generated/dataModel";

const CHARTS_GRID_CLASS = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";

type AssignersSeatsChartsPageProps = {
  classId: Id<"classes">;
};

export function AssignersSeatsChartsPage({ classId }: AssignersSeatsChartsPageProps) {
  const { t } = useTranslation("assigners");
  const navigate = useNavigate();
  const { can } = useCan();
  const canManage = can("assigners:manage");
  const { data, isPending, isError, refetch } = useSeatCharts(classId);
  const createChart = useCreateSeatChart();
  const renameChart = useRenameSeatChart();
  const archiveChart = useArchiveSeatChart();
  const [createOpen, setCreateOpen] = useState(false);
  const [renaming, setRenaming] = useState<SeatChartListItem | null>(null);
  const [sortKey, setSortKey] = useState<SeatChartSortKey>("updated");
  const [sortDirection, setSortDirection] = useState<SeatChartSortDirection>("desc");

  const sorted = useMemo(
    () => (data ? sortSeatCharts(data, sortKey, sortDirection) : []),
    [data, sortDirection, sortKey],
  );

  return (
    <AssignersSeatsShell
      classId={classId}
      tab="charts"
      description={t("chartsDescription")}
      action={
        canManage ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("createChart")}
          </Button>
        ) : null
      }
    >
      {!isPending && !isError && data && data.length > 0 ? (
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={[sortKey]}
          onValueChange={(values) => {
            const next = values[0] as SeatChartSortKey | undefined;
            if (!next) return;
            setSortKey(next);
            setSortDirection((current) =>
              sortKey === next
                ? current === "asc"
                  ? "desc"
                  : "asc"
                : next === "name"
                  ? "asc"
                  : "desc",
            );
          }}
          className="flex-wrap"
        >
          {(["name", "updated", "records"] as const).map((key) => (
            <ToggleGroupItem key={key} value={key} className="px-3">
              {t(`chartSort_${key}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : null}

      {isPending ? (
        <div className={CHARTS_GRID_CLASS}>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <ErrorState
          title={t("chartLoadFailed")}
          description={t("chartLoadFailedDescription")}
          onRetry={() => void refetch()}
        />
      ) : null}

      {!isPending && !isError && data && data.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayoutGrid />
            </EmptyMedia>
            <EmptyTitle>{t("chartsEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("chartsEmptyDescription")}</EmptyDescription>
          </EmptyHeader>
          {canManage ? (
            <EmptyContent>
              <Button type="button" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                {t("createChart")}
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : null}

      {!isPending && !isError && sorted.length > 0 ? (
        <ul className={CHARTS_GRID_CLASS}>
          {sorted.map((chart) => {
            const menuItems: Array<ActionMenuItem> = [
              {
                id: "rename",
                label: t("renameChart"),
                icon: <Pencil />,
                permission: "assigners:manage",
                group: "manage",
                onSelect: () => setRenaming(chart),
              },
              {
                id: "archive",
                label: t("archiveChart"),
                icon: <Archive />,
                permission: "assigners:manage",
                variant: "destructive",
                group: "danger",
                onSelect: () => void archiveChart.mutateAsync({ classId, chartId: chart._id }),
              },
            ];

            return (
              <li key={chart._id}>
                <Card size="sm" className="relative transition-colors hover:bg-accent/40">
                  <Link
                    to="/class/$classId/assigners/seats/charts/$chartId"
                    params={{ classId, chartId: chart._id }}
                    className="absolute inset-0 z-0 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label={t("openChart", { name: chart.name })}
                  />
                  <CardHeader className="relative z-10 flex flex-row items-start gap-3 pointer-events-none">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate text-base font-semibold">
                        {chart.name}
                      </CardTitle>
                      <CardDescription className="mt-1">{chart.layoutName}</CardDescription>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 pointer-events-auto">
                      <ActionMenu items={menuItems} label={t("chartActions")} />
                      <Badge variant="secondary">
                        {t("chartRecordCount", { count: chart.recordCount })}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardFooter className="relative z-10 border-t text-xs text-muted-foreground pointer-events-none">
                    {t("chartSeatedCount", { count: chart.seatedCount })} ·{" "}
                    {t("updatedAt", { date: formatLocalizedDateTime(chart.updatedAt) })}
                  </CardFooter>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : null}

      {canManage ? (
        <>
          <SeatChartCreateCredenza
            classId={classId}
            open={createOpen}
            onOpenChange={setCreateOpen}
            onSubmit={async ({ name, layoutId }) => {
              const chartId = await createChart.mutateAsync({ classId, name, layoutId });
              await navigate({
                to: "/class/$classId/assigners/seats/charts/$chartId",
                params: { classId, chartId },
              });
            }}
          />
          <SeatChartNameCredenza
            open={renaming !== null}
            onOpenChange={(open) => {
              if (!open) setRenaming(null);
            }}
            title={t("renameChartTitle")}
            description={t("createChartDescription")}
            initialName={renaming?.name ?? ""}
            onSubmit={async (name) => {
              if (!renaming) return;
              await renameChart.mutateAsync({ classId, chartId: renaming._id, name });
            }}
          />
        </>
      ) : null}
    </AssignersSeatsShell>
  );
}
