import {
  AwardIcon,
  Coins,
  FlagIcon,
  GiftIcon,
  TriangleAlertIcon,
  TrophyIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { DataTableSortableHeader } from "@/components/feedback/DataTableSortableHeader";
import { PersonalStudentPicker } from "@/components/personal/PersonalStudentPicker";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePointsForAudience } from "@/hooks/points/usePointsForAudience";
import { usePointsLedgerFilter } from "@/hooks/points/usePointsLedgerFilter";
import {
  usePointsLedgerForAudience,
  type PointsLedgerItem,
} from "@/hooks/points/usePointsLedgerForAudience";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { formatLocalizedDateTime } from "@/i18n/formatDate";
import { localDateKey } from "@/lib/attendance/dateKey";
import {
  isAbsentStudent,
  type PointsBoardStudent,
  type PointsSortDirection,
} from "@/lib/points/points";
import {
  nextPointsLedgerSortState,
  POINTS_LEDGER_DESCRIPTION_FILTERS,
  togglePointsLedgerDescriptionFilter,
  type PointsLedgerDescriptionFilter,
  type PointsLedgerSortKey,
} from "@/lib/points/pointsLedgerFilter";
import { ONE_HOUR } from "@/lib/queryCache";
import {
  getRosterDisplayName,
  resolveRosterNameFormat,
  type RosterNameFormat,
} from "@/lib/roster/roster";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type PersonalPointsPageProps = {
  classId: Id<"classes">;
};

type PersonalPointStudentCardProps = {
  student: PointsBoardStudent;
  nameFormat: RosterNameFormat;
};

function attendanceLabelKey(
  status: PointsBoardStudent["attendanceStatus"],
): "statusPresent" | "statusAbsent" | "statusLate" | "statusUnset" {
  if (status === "present") return "statusPresent";
  if (status === "absent") return "statusAbsent";
  if (status === "late") return "statusLate";
  return "statusUnset";
}

function PersonalPointStudentCard({ student, nameFormat }: PersonalPointStudentCardProps) {
  const { t } = useTranslation("points");
  const { t: tAttendance } = useTranslation("attendance");
  const { t: tClasses } = useTranslation("classes");
  const displayName = getRosterDisplayName(student, tClasses("unnamedMember"), nameFormat);
  const absent = isAbsentStudent(student);
  const attendanceKey = attendanceLabelKey(student.attendanceStatus);

  return (
    <div
      className={cn("flex w-full flex-col gap-3 rounded-2xl border p-4", absent && "opacity-60")}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums">
              {student.rosterNumber}
            </span>
            <p className="truncate font-medium">{displayName}</p>
          </div>
          <span className="mt-1 inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {tAttendance(attendanceKey)}
          </span>
        </div>
        {student.warningCount > 0 || student.minusCount > 0 ? (
          <span className="inline-flex shrink-0 items-center gap-2">
            {student.warningCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <TriangleAlertIcon className="size-4" aria-hidden />
                <span className="text-sm font-semibold tabular-nums">{student.warningCount}</span>
                <span className="sr-only">
                  {t("warningsCount", { count: student.warningCount })}
                </span>
              </span>
            ) : null}
            {student.minusCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                <FlagIcon className="size-4" aria-hidden />
                <span className="text-sm font-semibold tabular-nums">{student.minusCount}</span>
                <span className="sr-only">{t("minusCount", { count: student.minusCount })}</span>
              </span>
            ) : null}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <div
          className="flex items-center gap-2 text-lg font-semibold tabular-nums"
          aria-label={t("statBalanceAria", { count: student.pointsBalance })}
        >
          <TrophyIcon className="size-5 shrink-0 text-amber-400" aria-hidden />
          <span>{t("pointsBalance", { count: student.pointsBalance })}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm tabular-nums text-muted-foreground">
          <span
            className="inline-flex items-center gap-1.5"
            aria-label={t("statAwardedAria", { count: student.pointsAwarded })}
          >
            <AwardIcon className="size-4 shrink-0 text-amber-500/90" aria-hidden />
            <span>{student.pointsAwarded}</span>
          </span>
          <span
            className="inline-flex items-center gap-1.5"
            aria-label={t("statRemovedAria", { count: student.pointsRemoved })}
          >
            <FlagIcon className="size-4 shrink-0 text-rose-500/90" aria-hidden />
            <span>{student.pointsRemoved === 0 ? 0 : -student.pointsRemoved}</span>
          </span>
          <span
            className="inline-flex items-center gap-1.5"
            aria-label={t("statRedeemedAria", { count: student.pointsRedeemed })}
          >
            <GiftIcon className="size-4 shrink-0 text-emerald-500/90" aria-hidden />
            <span>{student.pointsRedeemed}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function ledgerDescription(item: PointsLedgerItem, t: (key: string) => string) {
  if (item.kind === "warning") {
    return item.dateKey;
  }
  return item.name?.trim() ? item.name : t("ledgerDeletedItem");
}

function ledgerAmount(item: PointsLedgerItem): string | null {
  if (item.kind === "warning") return null;
  // pointsApplied / pointsCost are already quantity-inclusive snapshots.
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

export function PersonalPointsPage({ classId }: PersonalPointsPageProps) {
  const { t } = useTranslation("points");
  const dateKey = useMemo(() => localDateKey(), []);
  const { data: classDoc } = useAuthedQuery(api.classes.get, { classId }, { gcTime: ONE_HOUR });
  const { data, isPending, isError, refetch } = usePointsForAudience(classId, dateKey);
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(null);
  const [sortKey, setSortKey] = useState<PointsLedgerSortKey>("date");
  const [sortDirection, setSortDirection] = useState<PointsSortDirection>("desc");
  const [descriptionFilters, setDescriptionFilters] = useState<Set<PointsLedgerDescriptionFilter>>(
    () => new Set(),
  );

  const nameFormat = resolveRosterNameFormat(classDoc ?? {});
  const students = data ?? [];
  const activeStudentId =
    selectedUserId && students.some((student) => student.userId === selectedUserId)
      ? selectedUserId
      : (students[0]?.userId ?? null);

  const ledger = usePointsLedgerForAudience(classId, activeStudentId);
  const { filtered: visibleLedgerItems } = usePointsLedgerFilter({
    items: ledger.items,
    descriptionFilters,
    sortKey,
    sortDirection,
  });

  useEffect(() => {
    setSortKey("date");
    setSortDirection("desc");
    setDescriptionFilters(new Set());
  }, [activeStudentId]);

  const onLedgerSort = (key: PointsLedgerSortKey) => {
    const next = nextPointsLedgerSortState(sortKey, sortDirection, key);
    setSortKey(next.sortKey);
    setSortDirection(next.sortDirection);
  };

  const filtersActive = descriptionFilters.size > 0;

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("personalTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("personalDescription")}</p>
      </div>

      {isPending ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="h-36 w-full rounded-2xl" />
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

      {!isPending && !isError && students.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>{t("personalStudentsEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("personalStudentsEmptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {!isPending && !isError && students.length > 0 ? (
        <>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {students.map((student) => (
              <li key={student.userId}>
                <PersonalPointStudentCard student={student} nameFormat={nameFormat} />
              </li>
            ))}
          </ul>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Coins className="size-3.5 shrink-0" aria-hidden />
            {t("personalReadOnlyHint")}
          </p>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium tracking-tight">{t("ledgerTitle")}</h2>
            {activeStudentId ? (
              <PersonalStudentPicker
                students={students}
                selectedUserId={activeStudentId}
                nameFormat={nameFormat}
                onSelect={setSelectedUserId}
              />
            ) : null}

            {ledger.isPending ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ) : null}

            {ledger.isError ? (
              <ErrorState
                title={t("ledgerLoadFailed")}
                description={t("loadFailedDescription")}
                onRetry={() => void ledger.refetch()}
              />
            ) : null}

            {!ledger.isPending && !ledger.isError && ledger.items.length === 0 ? (
              <p className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                {t("ledgerEmpty")}
              </p>
            ) : null}

            {!ledger.isPending && !ledger.isError && ledger.items.length > 0 ? (
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleLedgerItems.map((item) => {
                      const amount = ledgerAmount(item);
                      return (
                        <TableRow key={`${item.kind}-${item.id}`}>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {formatLocalizedDateTime(item.at)}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex min-w-0 items-center gap-2">
                              <LedgerKindIcon item={item} />
                              <span className="min-w-0 font-medium">
                                {ledgerDescription(item, t)}
                              </span>
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {amount ?? "—"}
                          </TableCell>
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

            {ledger.hasNextPage ? (
              <AsyncButton
                type="button"
                variant="outline"
                className="self-center"
                pending={ledger.isFetchingNextPage}
                onClick={async () => {
                  await ledger.fetchNextPage();
                }}
              >
                {t("ledgerLoadMore")}
              </AsyncButton>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
