import { AwardIcon, FlagIcon, GiftIcon, TriangleAlertIcon, Trash2Icon, XIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { DataTableSortableHeader } from "@/components/feedback/DataTableSortableHeader";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PointsLedgerItem } from "@/hooks/points/usePointsLedgerForAudience";
import { usePointsLedgerFilter } from "@/hooks/points/usePointsLedgerFilter";
import { formatLocalizedDateTime } from "@/i18n/formatDate";
import { type PointsSortDirection } from "@/lib/points/points";
import {
  nextPointsLedgerSortState,
  POINTS_LEDGER_DESCRIPTION_FILTERS,
  togglePointsLedgerDescriptionFilter,
  type PointsLedgerDescriptionFilter,
  type PointsLedgerSortKey,
} from "@/lib/points/pointsLedgerFilter";
import { isDeletableLedgerItem } from "@/lib/points/pointsLedgerOptimistic";

function ledgerDescription(item: PointsLedgerItem, t: (key: string) => string) {
  if (item.kind === "warning") {
    return item.dateKey;
  }
  return item.name?.trim() ? item.name : t("ledgerDeletedItem");
}

function ledgerNote(item: PointsLedgerItem): string | null {
  if (item.kind !== "behavior") return null;
  const note = item.note?.trim();
  return note ? note : null;
}

function ledgerAmount(item: PointsLedgerItem): string | null {
  if (item.kind === "warning") return null;
  if (item.kind === "behavior") {
    return item.pointsApplied > 0 ? `+${item.pointsApplied}` : String(item.pointsApplied);
  }
  return item.pointsCost === 0 ? "0" : `-${item.pointsCost}`;
}

function LedgerKindIcon({ item }: { item: PointsLedgerItem }) {
  if (item.kind === "warning") {
    return <TriangleAlertIcon className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />;
  }
  if (item.kind === "reward") {
    return <GiftIcon className="size-4 shrink-0 text-emerald-500/90" />;
  }
  if (item.pointsApplied < 0) {
    return <FlagIcon className="size-4 shrink-0 text-rose-500/90" />;
  }
  return <AwardIcon className="size-4 shrink-0 text-amber-500/90" />;
}

const LEDGER_FILTER_LABEL_KEY = {
  award: "ledgerFilterAward",
  remove: "ledgerFilterRemove",
  reward: "ledgerFilterReward",
  warning: "ledgerFilterWarning",
} as const satisfies Record<PointsLedgerDescriptionFilter, string>;

function LedgerDescriptionFilterIcon({ filter }: { filter: PointsLedgerDescriptionFilter }) {
  if (filter === "warning") {
    return <TriangleAlertIcon className="size-3.5 text-amber-600 dark:text-amber-400" />;
  }
  if (filter === "reward") {
    return <GiftIcon className="size-3.5 text-emerald-500/90" />;
  }
  if (filter === "remove") {
    return <FlagIcon className="size-3.5 text-rose-500/90" />;
  }
  return <AwardIcon className="size-3.5 text-amber-500/90" />;
}

type LedgerFilterIconButtonProps = {
  label: string;
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
};

function LedgerFilterIconButton({
  label,
  pressed,
  onClick,
  children,
}: LedgerFilterIconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            variant={pressed ? "default" : "outline"}
            aria-pressed={pressed}
            onClick={onClick}
            className="size-7 shrink-0"
          />
        }
      >
        <span aria-hidden="true" className="flex items-center justify-center">
          {children}
        </span>
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export type PointsLedgerTableProps = {
  items: PointsLedgerItem[];
  isPending: boolean;
  isRefreshing: boolean;
  isError: boolean;
  onRetry: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => Promise<unknown>;
  resetKey?: string | null;
  canDelete?: boolean;
  onDelete?: (item: Extract<PointsLedgerItem, { kind: "behavior" | "reward" }>) => void;
};

export function PointsLedgerTable({
  items,
  isPending,
  isRefreshing,
  isError,
  onRetry,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  resetKey,
  canDelete = false,
  onDelete,
}: PointsLedgerTableProps) {
  const { t } = useTranslation("points");
  const { t: tCommon } = useTranslation("common");
  const [sortKey, setSortKey] = useState<PointsLedgerSortKey>("date");
  const [sortDirection, setSortDirection] = useState<PointsSortDirection>("desc");
  const [descriptionFilters, setDescriptionFilters] = useState<Set<PointsLedgerDescriptionFilter>>(
    () => new Set(),
  );

  const { filtered: visibleLedgerItems } = usePointsLedgerFilter({
    items,
    descriptionFilters,
    sortKey,
    sortDirection,
  });

  useEffect(() => {
    setSortKey("date");
    setSortDirection("desc");
    setDescriptionFilters(new Set());
  }, [resetKey]);

  const onLedgerSort = (key: PointsLedgerSortKey) => {
    const next = nextPointsLedgerSortState(sortKey, sortDirection, key);
    setSortKey(next.sortKey);
    setSortDirection(next.sortDirection);
  };

  const filtersActive = descriptionFilters.size > 0;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium tracking-tight">{t("ledgerTitle")}</h2>

      {isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ) : null}

      {isRefreshing ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner className="size-3.5" aria-label={tCommon("loading")} />
          {tCommon("loading")}
        </p>
      ) : null}

      {isError ? (
        <ErrorState
          title={t("ledgerLoadFailed")}
          description={t("loadFailedDescription")}
          onRetry={onRetry}
        />
      ) : null}

      {!isPending && !isError && items.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {t("ledgerEmpty")}
        </p>
      ) : null}

      {!isPending && !isError && items.length > 0 ? (
        <div className="rounded-2xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <DataTableSortableHeader
                    label={t("ledgerDate")}
                    sorted={sortKey === "date" ? sortDirection : false}
                    onSort={() => onLedgerSort("date")}
                  />
                </TableHead>
                <TableHead>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>{t("ledgerDescription")}</span>
                    <div className="flex items-center gap-1">
                      {POINTS_LEDGER_DESCRIPTION_FILTERS.map((filter) => {
                        const label = t(LEDGER_FILTER_LABEL_KEY[filter]);
                        return (
                          <LedgerFilterIconButton
                            key={filter}
                            label={label}
                            pressed={descriptionFilters.has(filter)}
                            onClick={() =>
                              setDescriptionFilters((current) =>
                                togglePointsLedgerDescriptionFilter(current, filter),
                              )
                            }
                          >
                            <LedgerDescriptionFilterIcon filter={filter} />
                          </LedgerFilterIconButton>
                        );
                      })}
                      {filtersActive ? (
                        <LedgerFilterIconButton
                          label={t("ledgerFilterClear")}
                          pressed={false}
                          onClick={() => setDescriptionFilters(new Set())}
                        >
                          <XIcon className="size-3.5" />
                        </LedgerFilterIconButton>
                      ) : null}
                    </div>
                  </div>
                </TableHead>
                <TableHead className="text-right">
                  <div className="flex justify-end">
                    <DataTableSortableHeader
                      label={t("ledgerAmount")}
                      sorted={sortKey === "points" ? sortDirection : false}
                      onSort={() => onLedgerSort("points")}
                    />
                  </div>
                </TableHead>
                {canDelete ? (
                  <TableHead className="w-12">
                    <span className="sr-only">{t("ledgerDelete")}</span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleLedgerItems.map((item) => {
                const amount = ledgerAmount(item);
                const note = ledgerNote(item);
                const description = ledgerDescription(item, t);
                return (
                  <TableRow key={`${item.kind}-${item.id}`}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatLocalizedDateTime(item.at)}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex min-w-0 items-start gap-2">
                        <span className="mt-0.5">
                          <LedgerKindIcon item={item} />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium">{description}</span>
                          {note ? (
                            <span className="mt-0.5 block text-sm font-normal text-muted-foreground">
                              {note}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {amount ?? "—"}
                    </TableCell>
                    {canDelete ? (
                      <TableCell className="text-right">
                        {isDeletableLedgerItem(item) && onDelete ? (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            aria-label={t("ledgerDeleteAria", { description })}
                            onClick={() => onDelete(item)}
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {visibleLedgerItems.length === 0 ? (
            <p className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
              {t("ledgerFilterNoResults")}
            </p>
          ) : null}
        </div>
      ) : null}

      {hasNextPage ? (
        <AsyncButton
          type="button"
          variant="outline"
          className="self-center"
          pending={isFetchingNextPage}
          onClick={async () => {
            await onLoadMore();
          }}
        >
          {t("ledgerLoadMore")}
        </AsyncButton>
      ) : null}
    </section>
  );
}
