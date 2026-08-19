import { Link, useNavigate } from "@tanstack/react-router";
import { LayoutGrid, Pencil, Plus, RockingChair, Table2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AutoAssignProgressButton } from "@/components/assigners/AutoAssignProgressButton";
import { AutoAssignSeatingHost } from "@/components/assigners/AutoAssignSeatingHost";
import { AssignersSeatsShell } from "@/components/assigners/AssignersSeatsShell";
import {
  SeatChartPrintHost,
  type SeatChartPrintMode,
} from "@/components/assigners/SeatChartPrintHost";
import { SeatLayoutCreateCredenza } from "@/components/assigners/SeatLayoutCreateCredenza";
import { SeatLayoutNameCredenza } from "@/components/assigners/SeatLayoutNameCredenza";
import { DeleteNamedCredenza } from "@/components/groups/DeleteNamedCredenza";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
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
import { useCopySeatLayout } from "@/hooks/assigners/useCopySeatLayout";
import { useCreateSeatLayout } from "@/hooks/assigners/useCreateSeatLayout";
import { useRemoveSeatLayout } from "@/hooks/assigners/useRemoveSeatLayout";
import { useRenameSeatLayout } from "@/hooks/assigners/useRenameSeatLayout";
import { useRunAutoAssignSeatingFlow } from "@/hooks/assigners/useRunAutoAssignSeatingFlow";
import { useSeatCharts } from "@/hooks/assigners/useSeatCharts";
import { useSeatLayouts } from "@/hooks/assigners/useSeatLayouts";
import { useCan } from "@/hooks/permissions/useCan";
import { formatLocalizedDateTime } from "@/i18n/formatDate";
import { latestChartForLayout } from "@/lib/assigners/seatCharts";
import {
  nextSeatLayoutSortState,
  sortSeatLayouts,
  type SeatLayoutListItem,
  type SeatLayoutSortDirection,
  type SeatLayoutSortKey,
} from "@/lib/assigners/seatLayouts";
import type { Id } from "../../../convex/_generated/dataModel";

const SEATS_GRID_CLASS = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";

type AssignersSeatsPageProps = {
  classId: Id<"classes">;
};

function sortLabel(
  key: SeatLayoutSortKey,
  activeKey: SeatLayoutSortKey,
  direction: SeatLayoutSortDirection,
  labels: Record<SeatLayoutSortKey, string>,
): string {
  const base = labels[key];
  if (key !== activeKey) return base;
  if (key === "name") {
    return `${base} ${direction === "asc" ? "↓" : "↑"}`;
  }
  return `${base} ${direction === "asc" ? "↑" : "↓"}`;
}

export function AssignersSeatsPage({ classId }: AssignersSeatsPageProps) {
  const { t } = useTranslation("assigners");
  const navigate = useNavigate();
  const { can } = useCan();
  const canManage = can("assigners:manage");
  const { data, isPending, isError, refetch } = useSeatLayouts(classId);
  const { data: charts } = useSeatCharts(classId);
  const createLayout = useCreateSeatLayout();
  const copyLayout = useCopySeatLayout();
  const renameLayout = useRenameSeatLayout();
  const removeLayout = useRemoveSeatLayout();
  const autoAssignFlow = useRunAutoAssignSeatingFlow(classId);
  const [createOpen, setCreateOpen] = useState(false);
  const [renaming, setRenaming] = useState<SeatLayoutListItem | null>(null);
  const [deleting, setDeleting] = useState<SeatLayoutListItem | null>(null);
  const [sortKey, setSortKey] = useState<SeatLayoutSortKey>("updated");
  const [sortDirection, setSortDirection] = useState<SeatLayoutSortDirection>("desc");
  const [autoAssignLayout, setAutoAssignLayout] = useState<SeatLayoutListItem | null>(null);
  const [autoAssignOpen, setAutoAssignOpen] = useState(false);
  const [printRequest, setPrintRequest] = useState<{
    chartId: Id<"seatCharts">;
    mode: SeatChartPrintMode;
  } | null>(null);

  const sorted = useMemo(
    () => (data ? sortSeatLayouts(data, sortKey, sortDirection) : []),
    [data, sortDirection, sortKey],
  );

  const sortLabels: Record<SeatLayoutSortKey, string> = {
    name: t("sortName"),
    created: t("sortCreated"),
    updated: t("sortUpdated"),
  };

  return (
    <AssignersSeatsShell
      classId={classId}
      tab="layouts"
      description={t("seatsDescription")}
      action={
        canManage ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("createLayout")}
          </Button>
        ) : null
      }
    >
      {!isPending && !isError && data && data.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            variant="outline"
            spacing={0}
            value={[sortKey]}
            onValueChange={(values) => {
              const next = values[0] as SeatLayoutSortKey | undefined;
              const state = nextSeatLayoutSortState(sortKey, sortDirection, next ?? sortKey);
              setSortKey(state.sortKey);
              setSortDirection(state.sortDirection);
            }}
            className="flex-wrap"
          >
            {(["name", "created", "updated"] as const).map((key) => (
              <ToggleGroupItem key={key} value={key} className="px-3">
                {sortLabel(key, sortKey, sortDirection, sortLabels)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      ) : null}

      {isPending ? (
        <div className={SEATS_GRID_CLASS}>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedDescription")}
          onRetry={() => void refetch()}
        />
      ) : null}

      {!isPending && !isError && data && data.length === 0 ? (
        <Empty card>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RockingChair />
            </EmptyMedia>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
          </EmptyHeader>
          {canManage ? (
            <EmptyContent>
              <Button type="button" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                {t("createLayout")}
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : null}

      {!isPending && !isError && sorted.length > 0 ? (
        <ul className={SEATS_GRID_CLASS}>
          {sorted.map((layout) => {
            const latestChart = charts ? latestChartForLayout(charts, layout._id) : null;
            const menuItems: Array<ActionMenuItem> = [
              ...(latestChart
                ? [
                    {
                      id: "print-layout",
                      label: t("printLayout"),
                      icon: <LayoutGrid />,
                      group: "view",
                      onSelect: () => setPrintRequest({ chartId: latestChart._id, mode: "layout" }),
                    } satisfies ActionMenuItem,
                    {
                      id: "print-table",
                      label: t("printTable"),
                      icon: <Table2 />,
                      group: "view",
                      onSelect: () => setPrintRequest({ chartId: latestChart._id, mode: "table" }),
                    } satisfies ActionMenuItem,
                  ]
                : []),
              {
                id: "edit",
                label: t("editAction"),
                icon: <Pencil />,
                permission: "assigners:manage",
                group: "manage",
                onSelect: () => setRenaming(layout),
              },
              {
                id: "delete",
                label: t("deleteLayout"),
                icon: <Trash2 />,
                permission: "assigners:manage",
                variant: "destructive",
                group: "danger",
                onSelect: () => setDeleting(layout),
              },
            ];

            return (
              <li key={layout._id}>
                <Card size="sm" className="relative h-full transition-colors hover:bg-accent/40">
                  <Link
                    to="/class/$classId/assigners/seats/layouts/$layoutId"
                    params={{ classId, layoutId: layout._id }}
                    className="absolute inset-0 z-0 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label={t("openLayout", { name: layout.name })}
                  />
                  <CardHeader className="relative z-10 flex flex-row items-start gap-3 pointer-events-none">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate text-base font-semibold">
                        {layout.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {t("deskCount", { count: layout.deskCount })}
                      </CardDescription>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 pointer-events-auto">
                      {canManage ? (
                        <AutoAssignProgressButton
                          size="sm"
                          progress={
                            autoAssignLayout?._id === layout._id ? autoAssignFlow.progress : 0
                          }
                          pending={autoAssignFlow.isRunning && autoAssignLayout?._id === layout._id}
                          disabled={
                            autoAssignFlow.isRunning && autoAssignLayout?._id !== layout._id
                          }
                          onClick={() => {
                            setAutoAssignLayout(layout);
                            setAutoAssignOpen(true);
                          }}
                        />
                      ) : null}
                      <ActionMenu items={menuItems} label={t("layoutActions")} />
                    </div>
                  </CardHeader>
                  <CardFooter className="relative z-10 mt-auto border-t text-xs text-muted-foreground pointer-events-none">
                    {t("updatedAt", { date: formatLocalizedDateTime(layout.updatedAt) })}
                  </CardFooter>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : null}

      <SeatChartPrintHost
        classId={classId}
        chartId={printRequest?.chartId ?? null}
        mode={printRequest?.mode ?? "layout"}
        open={printRequest !== null}
        onOpenChange={(open) => {
          if (!open) setPrintRequest(null);
        }}
      />

      {canManage ? (
        <>
          <SeatLayoutCreateCredenza
            open={createOpen}
            onOpenChange={setCreateOpen}
            classId={classId}
            onCreate={async (name) => {
              const layoutId = await createLayout.mutateAsync({ classId, name });
              await navigate({
                to: "/class/$classId/assigners/seats/layouts/$layoutId",
                params: { classId, layoutId },
              });
            }}
            onCopy={async ({ name, sourceClassId, sourceLayoutId }) => {
              const layoutId = await copyLayout.mutateAsync({
                classId,
                name,
                sourceClassId,
                sourceLayoutId,
              });
              await navigate({
                to: "/class/$classId/assigners/seats/layouts/$layoutId",
                params: { classId, layoutId },
              });
            }}
          />
          <SeatLayoutNameCredenza
            open={renaming !== null}
            onOpenChange={(open) => {
              if (!open) setRenaming(null);
            }}
            title={t("renameLayoutTitle")}
            description={t("createLayoutDescription")}
            initialName={renaming?.name ?? ""}
            onSubmit={async (name) => {
              if (!renaming) return;
              await renameLayout.mutateAsync({
                classId,
                layoutId: renaming._id,
                name,
              });
            }}
          />
          <DeleteNamedCredenza
            open={deleting !== null}
            onOpenChange={(open) => {
              if (!open) setDeleting(null);
            }}
            title={t("deleteLayoutTitle")}
            description={t("deleteLayoutDescription", { name: deleting?.name ?? "" })}
            confirmLabel={t("confirmDelete")}
            onConfirm={async () => {
              if (!deleting) return;
              await removeLayout.mutateAsync({ classId, layoutId: deleting._id });
            }}
          />
          <AutoAssignSeatingHost
            classId={classId}
            flow={autoAssignFlow}
            open={autoAssignOpen}
            onOpenChange={setAutoAssignOpen}
            fixedLayoutId={autoAssignLayout?._id}
            fixedLayoutName={autoAssignLayout?.name}
          />
        </>
      ) : null}
    </AssignersSeatsShell>
  );
}
