import { Armchair, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AssignersSeatsShell } from "@/components/assigners/AssignersSeatsShell";
import { DataTableSortableHeader } from "@/components/feedback/DataTableSortableHeader";
import { PersonalStudentPicker } from "@/components/personal/PersonalStudentPicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSeatPersonalStatsForAudience } from "@/hooks/assigners/useSeatPersonalStatsForAudience";
import { useSeatPersonalStudentsForAudience } from "@/hooks/assigners/useSeatPersonalStudentsForAudience";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { formatLocalizedSeatChartHistoryDate } from "@/i18n/formatDate";
import { toIntlLocale } from "@/lib/languages";
import { ONE_HOUR } from "@/lib/queryCache";
import {
  getRosterDisplayName,
  resolveRosterNameFormat,
  type RosterNameFormat,
} from "@/lib/roster/roster";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type AssignersSeatsStatsPageProps = {
  classId: Id<"classes">;
};

type HistorySortKey = "date" | "layout" | "seat" | "zone" | "team" | "neighbors";
type SortDirection = "asc" | "desc";

type PersonalSeatHistoryItem = NonNullable<
  ReturnType<typeof useSeatPersonalStatsForAudience>["data"]
>["history"][number];

function formatMediumDateTime(timestampMs: number, language: string): string {
  const locale = toIntlLocale(language);
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestampMs));
}

function nextSortState(
  currentKey: HistorySortKey,
  currentDirection: SortDirection,
  nextKey: HistorySortKey,
): { sortKey: HistorySortKey; sortDirection: SortDirection } {
  if (currentKey === nextKey) {
    return {
      sortKey: currentKey,
      sortDirection: currentDirection === "asc" ? "desc" : "asc",
    };
  }
  return { sortKey: nextKey, sortDirection: nextKey === "date" ? "desc" : "asc" };
}

function compareNullableNumber(a: number | undefined, b: number | undefined): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return a - b;
}

function compareNullableString(a: string | undefined, b: string | undefined): number {
  const left = a?.trim() ?? "";
  const right = b?.trim() ?? "";
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right);
}

function sortHistoryItems(
  items: PersonalSeatHistoryItem[],
  sortKey: HistorySortKey,
  sortDirection: SortDirection,
): PersonalSeatHistoryItem[] {
  const sorted = [...items];
  const dir = sortDirection === "asc" ? 1 : -1;
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "date":
        cmp = a.recordedAt - b.recordedAt;
        break;
      case "layout":
        cmp = a.layoutName.localeCompare(b.layoutName);
        break;
      case "seat":
        cmp = compareNullableNumber(a.deskNumber, b.deskNumber);
        break;
      case "zone":
        cmp = compareNullableString(a.zoneName, b.zoneName);
        break;
      case "team":
        cmp = compareNullableString(a.teamLabel, b.teamLabel);
        break;
      case "neighbors":
        cmp = a.neighborDisplayNames.join(", ").localeCompare(b.neighborDisplayNames.join(", "));
        break;
    }
    return cmp * dir;
  });
  return sorted;
}

function matchesHistorySearch(item: PersonalSeatHistoryItem, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const haystack = [item.layoutName, item.zoneName, item.teamLabel]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(normalized);
}

type CurrentPlacement = NonNullable<
  NonNullable<ReturnType<typeof useSeatPersonalStatsForAudience>["data"]>["current"]
>;

function CurrentSeatSummaryCard({
  current,
  nameFormat,
  student,
}: {
  current: CurrentPlacement;
  nameFormat: RosterNameFormat;
  student: {
    userId: Id<"users">;
    firstName?: string;
    lastName?: string;
    name?: string;
  };
}) {
  const { t } = useTranslation("assigners");
  const { t: tClasses } = useTranslation("classes");
  const displayName = getRosterDisplayName(student, tClasses("unnamedMember"), nameFormat);

  const seatLabel =
    current.deskNumber !== undefined ? t("chartCurrentSeat", { seat: current.deskNumber }) : "—";
  const zoneLabel = current.zoneName?.trim() ? current.zoneName : "—";
  const teamLabel = current.teamLabel?.trim() ? current.teamLabel : "—";
  const neighborsLabel =
    current.neighborDisplayNames.length > 0 ? current.neighborDisplayNames.join(", ") : "—";

  return (
    <Card className="rounded-2xl">
      <CardHeader className="border-b">
        <CardTitle className="text-base">{t("seatsStatsCurrentTitle")}</CardTitle>
        <p className="text-sm text-muted-foreground">{displayName}</p>
      </CardHeader>
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("seatsStatsSeatLabel")}</span>
          <span className="text-sm font-medium tabular-nums">{seatLabel}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("seatsStatsTeamLabel")}</span>
          <span className="text-sm font-medium">{teamLabel}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("seatsStatsZoneLabel")}</span>
          <span className="text-sm font-medium">{zoneLabel}</span>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs text-muted-foreground">{t("seatsStatsNeighborsLabel")}</span>
          <span className="text-sm font-medium">{neighborsLabel}</span>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2 text-xs text-muted-foreground">
          <span>
            {current.layoutName} · {current.chartName}
          </span>
          <span>{formatLocalizedSeatChartHistoryDate(current.recordedAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function AssignersSeatsStatsPage({ classId }: AssignersSeatsStatsPageProps) {
  const { t, i18n } = useTranslation("assigners");
  const { data: classDoc } = useAuthedQuery(api.classes.get, { classId }, { gcTime: ONE_HOUR });
  const studentsQuery = useSeatPersonalStudentsForAudience(classId);
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<HistorySortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const nameFormat = resolveRosterNameFormat(classDoc ?? {});
  const students = studentsQuery.data ?? [];
  const activeStudentId =
    selectedUserId && students.some((student) => student.userId === selectedUserId)
      ? selectedUserId
      : (students[0]?.userId ?? null);
  const activeStudent =
    activeStudentId != null
      ? (students.find((student) => student.userId === activeStudentId) ?? null)
      : null;

  const statsQuery = useSeatPersonalStatsForAudience(classId, activeStudentId);

  const filteredHistory = useMemo(() => {
    const history = statsQuery.data?.history ?? [];
    if (!searchQuery.trim()) return history;
    return history.filter((item) => matchesHistorySearch(item, searchQuery));
  }, [statsQuery.data?.history, searchQuery]);

  const visibleHistory = useMemo(
    () => sortHistoryItems(filteredHistory, sortKey, sortDirection),
    [filteredHistory, sortKey, sortDirection],
  );

  useEffect(() => {
    setSortKey("date");
    setSortDirection("desc");
    setSearchQuery("");
  }, [activeStudentId]);

  const onHistorySort = (key: HistorySortKey) => {
    const next = nextSortState(sortKey, sortDirection, key);
    setSortKey(next.sortKey);
    setSortDirection(next.sortDirection);
  };

  return (
    <AssignersSeatsShell classId={classId} tab="stats" description={t("seatsStatsDescription")}>
      {studentsQuery.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : null}

      {studentsQuery.isError ? (
        <ErrorState
          title={t("seatsStatsLoadFailed")}
          description={t("seatsStatsLoadFailedDescription")}
          onRetry={() => void studentsQuery.refetch()}
        />
      ) : null}

      {!studentsQuery.isPending && !studentsQuery.isError && students.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Armchair />
            </EmptyMedia>
            <EmptyTitle>{t("seatsStatsStudentsEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("seatsStatsStudentsEmptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {!studentsQuery.isPending &&
      !studentsQuery.isError &&
      students.length > 0 &&
      activeStudent != null ? (
        <div className="flex flex-col gap-4">
          {students.length > 1 ? (
            <PersonalStudentPicker
              students={students}
              selectedUserId={activeStudent.userId}
              nameFormat={nameFormat}
              onSelect={setSelectedUserId}
            />
          ) : null}

          {statsQuery.isPending ? <Skeleton className="h-40 w-full rounded-2xl" /> : null}

          {statsQuery.isError ? (
            <ErrorState
              title={t("seatsStatsLoadFailed")}
              description={t("seatsStatsLoadFailedDescription")}
              onRetry={() => void statsQuery.refetch()}
            />
          ) : null}

          {!statsQuery.isPending && !statsQuery.isError && statsQuery.data?.current ? (
            <CurrentSeatSummaryCard
              current={statsQuery.data.current}
              nameFormat={nameFormat}
              student={activeStudent}
            />
          ) : null}

          {!statsQuery.isPending &&
          !statsQuery.isError &&
          !statsQuery.data?.current &&
          statsQuery.data ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyTitle>{t("seatsStatsNoRecordingTitle")}</EmptyTitle>
                <EmptyDescription>{t("seatsStatsNoRecordingDescription")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium tracking-tight">{t("seatsStatsHistoryTitle")}</h2>

            <InputGroup>
              <InputGroupAddon>
                <SearchIcon className="size-4" aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("seatsStatsHistorySearchPlaceholder")}
                aria-label={t("seatsStatsHistorySearchPlaceholder")}
              />
              {searchQuery.trim() ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label={t("seatsStatsHistorySearchClear")}
                    onClick={() => setSearchQuery("")}
                  >
                    <XIcon className="size-3.5" />
                  </InputGroupButton>
                </InputGroupAddon>
              ) : null}
              <InputGroupAddon align="inline-end">
                <InputGroupText>
                  {t("seatsStatsHistorySearchResults", { count: visibleHistory.length })}
                </InputGroupText>
              </InputGroupAddon>
            </InputGroup>

            {statsQuery.isPending ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ) : null}

            {!statsQuery.isPending &&
            !statsQuery.isError &&
            (statsQuery.data?.history.length ?? 0) === 0 ? (
              <p className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                {t("seatsStatsHistoryEmpty")}
              </p>
            ) : null}

            {!statsQuery.isPending &&
            !statsQuery.isError &&
            (statsQuery.data?.history.length ?? 0) > 0 &&
            visibleHistory.length === 0 ? (
              <p className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                {t("seatsStatsHistorySearchEmpty")}
              </p>
            ) : null}

            {!statsQuery.isPending && !statsQuery.isError && visibleHistory.length > 0 ? (
              <div className="rounded-2xl ring-1 ring-foreground/10">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <DataTableSortableHeader
                          label={t("seatsStatsHistoryDateLabel")}
                          sorted={sortKey === "date" ? sortDirection : false}
                          onSort={() => onHistorySort("date")}
                        />
                      </TableHead>
                      <TableHead>
                        <DataTableSortableHeader
                          label={t("seatsStatsHistoryLayoutLabel")}
                          sorted={sortKey === "layout" ? sortDirection : false}
                          onSort={() => onHistorySort("layout")}
                        />
                      </TableHead>
                      <TableHead>
                        <DataTableSortableHeader
                          label={t("seatsStatsSeatLabel")}
                          sorted={sortKey === "seat" ? sortDirection : false}
                          onSort={() => onHistorySort("seat")}
                        />
                      </TableHead>
                      <TableHead>
                        <DataTableSortableHeader
                          label={t("seatsStatsZoneLabel")}
                          sorted={sortKey === "zone" ? sortDirection : false}
                          onSort={() => onHistorySort("zone")}
                        />
                      </TableHead>
                      <TableHead>
                        <DataTableSortableHeader
                          label={t("seatsStatsTeamLabel")}
                          sorted={sortKey === "team" ? sortDirection : false}
                          onSort={() => onHistorySort("team")}
                        />
                      </TableHead>
                      <TableHead>
                        <DataTableSortableHeader
                          label={t("seatsStatsNeighborsLabel")}
                          sorted={sortKey === "neighbors" ? sortDirection : false}
                          onSort={() => onHistorySort("neighbors")}
                        />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleHistory.map((item) => (
                      <TableRow key={`${item.recordId}-${item.recordedAt}`}>
                        <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                          {formatMediumDateTime(item.recordedAt, i18n.language)}
                        </TableCell>
                        <TableCell className="font-medium">{item.layoutName}</TableCell>
                        <TableCell className="tabular-nums">
                          {item.deskNumber !== undefined
                            ? t("chartCurrentSeat", { seat: item.deskNumber })
                            : "—"}
                        </TableCell>
                        <TableCell>{item.zoneName?.trim() ? item.zoneName : "—"}</TableCell>
                        <TableCell>{item.teamLabel?.trim() ? item.teamLabel : "—"}</TableCell>
                        <TableCell className="max-w-48 truncate">
                          {item.neighborDisplayNames.length > 0
                            ? item.neighborDisplayNames.join(", ")
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </AssignersSeatsShell>
  );
}
