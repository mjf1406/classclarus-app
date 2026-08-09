import { useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { BookOpen, EyeIcon, EyeOffIcon, ExternalLink, SearchIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { DataTableSortableHeader } from "@/components/feedback/DataTableSortableHeader";
import {
  RazRecordAssessmentCredenza,
  type RazRecordAssessmentStudent,
} from "@/components/raz/RazRecordAssessmentCredenza";
import { RosterColumnVisibilityMenu } from "@/components/roster/RosterColumnVisibilityMenu";
import { RosterTable } from "@/components/roster/RosterTable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HelpTip } from "@/components/ui/help-tip";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMemberSearch } from "@/hooks/members/useMemberSearch";
import { useCan } from "@/hooks/permissions/useCan";
import { useRazInitialLevels } from "@/hooks/raz/useRazInitialLevels";
import { useRecordRazAssessment } from "@/hooks/raz/useRecordRazAssessment";
import { useSetRazManualStatus } from "@/hooks/raz/useSetRazManualStatus";
import { useClassUserSettings } from "@/hooks/roster/useClassUserSettings";
import { useEnsureStudentRosters } from "@/hooks/roster/useEnsureStudentRosters";
import { useRosterConsumerColumnVisibility } from "@/hooks/roster/useRosterConsumerColumnVisibility";
import { useStudentRoster } from "@/hooks/roster/useStudentRoster";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { getLanguageOption, isAppLanguage } from "@/lib/languages";
import { ONE_HOUR } from "@/lib/queryCache";
import {
  getRazAssessmentSchedule,
  getRazDisplayStatuses,
  getRazStatusExplanationReason,
  RAZ_DISPLAY_STATUSES,
  type RazDisplayStatus,
  type RazStatusExplanationReason,
} from "@/lib/raz/assessmentSchedule";
import type { RazManualStatus } from "@/lib/raz/levels";
import {
  getRosterDisplayName,
  normalizeColumnOrder,
  normalizeColumnVisibility,
  resolveRosterNameFormat,
  type StudentRosterEntry,
} from "@/lib/roster/roster";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const ASSESS_URL =
  "https://www.raz-kids.com/main/AssessmentResources/assessmentCategory/read-retell-respond";
const CHART_URL = "https://www.raz-kids.com/main/ViewPage/name/level-correlation-chart";
const RAZ_PAGE_SURFACE = "raz-page";

const STATUS_SORT_ORDER: Record<RazDisplayStatus, number> = {
  rti: 0,
  pending: 1,
  overdue: 2,
  due_now: 3,
  coming_soon: 4,
  up_to_date: 5,
};

const STATUS_I18N_KEY = {
  rti: "statusRti",
  pending: "statusPending",
  overdue: "statusOverdue",
  due_now: "statusDueNow",
  coming_soon: "statusComingSoon",
  up_to_date: "statusUpToDate",
} as const;

const STATUS_WHY_I18N_KEY = {
  rti: "statusWhy_rti",
  pending: "statusWhy_pending",
  overdue_never_assessed: "statusWhy_overdue_never_assessed",
  overdue_window: "statusWhy_overdue_window",
  due_now: "statusWhy_due_now",
  coming_soon: "statusWhy_coming_soon",
  up_to_date: "statusWhy_up_to_date",
} as const satisfies Record<RazStatusExplanationReason, string>;

type RazPageProps = {
  classId: Id<"classes">;
};

type RazLevelRow = {
  initialLevel: string;
  currentLevel: string;
  lastAssessedAt: number | null;
  lastAssessmentResult: "level_up" | "stay" | "level_down" | null;
  scheduleAnchorAt: number;
  manualStatus: RazManualStatus | null;
};

function primaryStatusSortOrder(statuses: readonly RazDisplayStatus[] | undefined): number {
  if (statuses == null || statuses.length === 0) return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  for (const status of statuses) {
    best = Math.min(best, STATUS_SORT_ORDER[status]);
  }
  return best;
}

function formatMediumDate(timestampMs: number, language: string): string {
  const locale = isAppLanguage(language) ? getLanguageOption(language).htmlLang : language;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(timestampMs));
}

function statusBadgeVariant(
  status: RazDisplayStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "rti":
    case "overdue":
      return "destructive";
    case "due_now":
      return "default";
    case "pending":
    case "coming_soon":
      return "secondary";
    case "up_to_date":
      return "outline";
  }
}

function isRazDisplayStatus(value: string): value is RazDisplayStatus {
  return (RAZ_DISPLAY_STATUSES as readonly string[]).includes(value);
}

export function RazPage({ classId }: RazPageProps) {
  const { t, i18n } = useTranslation("raz");
  const { t: tClasses } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const navigate = useNavigate();
  const { can, isPending: permissionsPending } = useCan();
  const canManage = !permissionsPending && can("raz:manage");
  const canReadStudents = !permissionsPending && can("students:read");

  const {
    data: levels,
    isPending: levelsPending,
    isError: levelsError,
    refetch: refetchLevels,
  } = useRazInitialLevels(classId);
  const {
    data: roster,
    isPending: rosterPending,
    isError: rosterError,
    refetch: refetchRoster,
    isAuthLoading,
  } = useStudentRoster(classId);
  const { data: settings } = useClassUserSettings(classId);
  const { data: classDoc } = useAuthedQuery(api.classes.get, { classId }, { gcTime: ONE_HOUR });
  const recordAssessment = useRecordRazAssessment();
  const setManualStatus = useSetRazManualStatus();

  useEnsureStudentRosters(classId, !rosterPending && !isAuthLoading && !rosterError);

  const [recordingStudent, setRecordingStudent] = useState<RazRecordAssessmentStudent | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [levelsHidden, setLevelsHidden] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<RazDisplayStatus[]>([]);
  const { filtered: nameFiltered } = useMemberSearch({ members: roster, query: searchQuery });

  const nameFormat = resolveRosterNameFormat(classDoc ?? {});
  const unnamed = tClasses("unnamedMember");

  const levelByStudent = useMemo(() => {
    const map = new Map<string, RazLevelRow>();
    for (const row of levels ?? []) {
      map.set(row.studentUserId, {
        initialLevel: row.initialLevel,
        currentLevel: row.currentLevel,
        lastAssessedAt: row.lastAssessedAt,
        lastAssessmentResult: row.lastAssessmentResult,
        scheduleAnchorAt: row.scheduleAnchorAt,
        manualStatus: row.manualStatus,
      });
    }
    return map;
  }, [levels]);

  const statusByStudent = useMemo(() => {
    const map = new Map<string, RazDisplayStatus[]>();
    for (const [userId, level] of levelByStudent) {
      const statuses = getRazDisplayStatuses({
        level: level.currentLevel,
        scheduleAnchorAt: level.scheduleAnchorAt,
        lastAssessedAt: level.lastAssessedAt,
        manualStatus: level.manualStatus,
      });
      if (statuses.length > 0) map.set(userId, statuses);
    }
    return map;
  }, [levelByStudent]);

  const filtered = useMemo(() => {
    if (selectedStatuses.length === 0) return nameFiltered;
    const selected = new Set(selectedStatuses);
    return nameFiltered.filter((student) => {
      const statuses = statusByStudent.get(student.userId);
      return statuses != null && statuses.some((status) => selected.has(status));
    });
  }, [nameFiltered, selectedStatuses, statusByStudent]);

  const { total, remaining, setCount } = useMemo(() => {
    if (!canReadStudents || !roster) {
      return { total: 0, remaining: 0, setCount: 0 };
    }
    let unset = 0;
    for (const student of roster) {
      if (!levelByStudent.has(student.userId)) unset += 1;
    }
    const nextTotal = roster.length;
    return { total: nextTotal, remaining: unset, setCount: nextTotal - unset };
  }, [canReadStudents, levelByStudent, roster]);

  const students = roster ?? [];
  const columnOrder = useMemo(
    () => normalizeColumnOrder(settings?.studentsColumnOrder),
    [settings?.studentsColumnOrder],
  );
  const baseColumnVisibility = useMemo(
    () => normalizeColumnVisibility(settings?.studentsColumnVisibility),
    [settings?.studentsColumnVisibility],
  );
  const { columnVisibility, setColumnVisibility } = useRosterConsumerColumnVisibility(
    classId,
    RAZ_PAGE_SURFACE,
    baseColumnVisibility,
  );

  const extraColumns = useMemo((): ColumnDef<StudentRosterEntry, unknown>[] => {
    const cols: ColumnDef<StudentRosterEntry, unknown>[] = [
      {
        id: "razCurrentLevel",
        accessorFn: (student) => levelByStudent.get(student.userId)?.currentLevel ?? "",
        header: ({ column }) => (
          <DataTableSortableHeader
            label={t("columnCurrentLevel")}
            sorted={column.getIsSorted()}
            onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => {
          const level = levelByStudent.get(row.original.userId)?.currentLevel;
          if (!level) {
            return <span className="text-muted-foreground">—</span>;
          }
          if (levelsHidden) {
            return <span className="text-muted-foreground">{t("levelHidden")}</span>;
          }
          return <span className="font-medium tabular-nums">{level}</span>;
        },
        sortingFn: (rowA, rowB) => {
          const a = levelByStudent.get(rowA.original.userId)?.currentLevel ?? "";
          const b = levelByStudent.get(rowB.original.userId)?.currentLevel ?? "";
          return a.localeCompare(b, undefined, { sensitivity: "base" });
        },
        enableSorting: true,
      },
      {
        id: "razStatus",
        accessorFn: (student) => primaryStatusSortOrder(statusByStudent.get(student.userId)),
        header: ({ column }) => (
          <DataTableSortableHeader
            label={t("columnStatus")}
            sorted={column.getIsSorted()}
            onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => {
          const level = levelByStudent.get(row.original.userId);
          const statuses = statusByStudent.get(row.original.userId);
          if (!level || !statuses || statuses.length === 0) {
            return <span className="text-muted-foreground">—</span>;
          }

          const schedule = getRazAssessmentSchedule(
            level.currentLevel,
            level.scheduleAnchorAt,
            Date.now(),
            level.lastAssessedAt,
            { forceOverdue: level.manualStatus === "rti" },
          );
          const whyReason = getRazStatusExplanationReason({
            manualStatus: level.manualStatus,
            lastAssessedAt: level.lastAssessedAt,
            scheduleStatus: schedule?.scheduleStatus ?? null,
          });
          const whyTip =
            whyReason == null ? null : (
              <HelpTip
                title={t("statusWhyTitle")}
                description={t(STATUS_WHY_I18N_KEY[whyReason])}
                ariaLabel={t("statusWhyHelpAria")}
                side="top"
              />
            );

          const badges = (
            <span className="flex flex-wrap items-center gap-1">
              {statuses.map((status) => (
                <Badge key={status} variant={statusBadgeVariant(status)}>
                  {t(STATUS_I18N_KEY[status])}
                </Badge>
              ))}
            </span>
          );

          if (!canManage) {
            return (
              <span className="flex items-center gap-1">
                {badges}
                {whyTip}
              </span>
            );
          }

          const selectValue = level.manualStatus ?? "auto";
          return (
            <span className="flex items-center gap-1">
              <Select
                value={selectValue}
                onValueChange={(next) => {
                  if (next == null) return;
                  const manualStatus: RazManualStatus | null =
                    next === "rti" || next === "pending" ? next : null;
                  void setManualStatus.mutateAsync({
                    classId,
                    studentUserId: row.original.userId,
                    manualStatus,
                  });
                }}
              >
                <SelectTrigger
                  size="sm"
                  className="h-auto w-auto border-0 bg-transparent p-0 shadow-none"
                >
                  <SelectValue>{badges}</SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectGroup>
                    <SelectItem value="auto">{t("statusAuto")}</SelectItem>
                    <SelectItem value="rti">{t("statusRti")}</SelectItem>
                    <SelectItem value="pending">{t("statusPending")}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              {whyTip}
            </span>
          );
        },
        sortingFn: (rowA, rowB) => {
          const orderA = primaryStatusSortOrder(statusByStudent.get(rowA.original.userId));
          const orderB = primaryStatusSortOrder(statusByStudent.get(rowB.original.userId));
          return orderA - orderB;
        },
        enableSorting: true,
      },
      {
        id: "razNextDue",
        accessorFn: (student) => {
          const level = levelByStudent.get(student.userId);
          if (!level) return Number.POSITIVE_INFINITY;
          const schedule = getRazAssessmentSchedule(
            level.currentLevel,
            level.scheduleAnchorAt,
            Date.now(),
            level.lastAssessedAt,
            { forceOverdue: level.manualStatus === "rti" },
          );
          return schedule?.daysUntilDue ?? Number.POSITIVE_INFINITY;
        },
        header: ({ column }) => (
          <DataTableSortableHeader
            label={t("columnNextDue")}
            sorted={column.getIsSorted()}
            onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => {
          const level = levelByStudent.get(row.original.userId);
          if (!level) {
            return <span className="text-muted-foreground">—</span>;
          }
          const schedule = getRazAssessmentSchedule(
            level.currentLevel,
            level.scheduleAnchorAt,
            Date.now(),
            level.lastAssessedAt,
            { forceOverdue: level.manualStatus === "rti" },
          );
          if (!schedule) {
            return <span className="text-muted-foreground">—</span>;
          }

          const relative =
            schedule.scheduleStatus === "overdue"
              ? t("dueOverdueDays", { count: Math.abs(schedule.daysUntilDue) })
              : schedule.scheduleStatus === "due_now"
                ? t("dueToday")
                : t("dueInDays", { count: schedule.daysUntilDue });

          return (
            <div className="flex min-w-[10rem] flex-col gap-0.5">
              <span className="font-medium">{relative}</span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {t("dueWindowDates", {
                  start: formatMediumDate(schedule.windowStartAt, i18n.language),
                  end: formatMediumDate(schedule.windowEndAt, i18n.language),
                })}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {t("dueRangeDays", {
                  lower: schedule.lowerBoundDays,
                  upper: schedule.upperBoundDays,
                })}
              </span>
            </div>
          );
        },
        sortingFn: (rowA, rowB) => {
          const nowMs = Date.now();
          const levelA = levelByStudent.get(rowA.original.userId);
          const levelB = levelByStudent.get(rowB.original.userId);
          const a =
            levelA == null
              ? Number.POSITIVE_INFINITY
              : (getRazAssessmentSchedule(
                  levelA.currentLevel,
                  levelA.scheduleAnchorAt,
                  nowMs,
                  levelA.lastAssessedAt,
                  { forceOverdue: levelA.manualStatus === "rti" },
                )?.daysUntilDue ?? Number.POSITIVE_INFINITY);
          const b =
            levelB == null
              ? Number.POSITIVE_INFINITY
              : (getRazAssessmentSchedule(
                  levelB.currentLevel,
                  levelB.scheduleAnchorAt,
                  nowMs,
                  levelB.lastAssessedAt,
                  { forceOverdue: levelB.manualStatus === "rti" },
                )?.daysUntilDue ?? Number.POSITIVE_INFINITY);
          return a - b;
        },
        enableSorting: true,
      },
    ];

    if (canManage) {
      cols.push({
        id: "razRecord",
        enableSorting: false,
        header: () => <span className="sr-only">{t("recordAction")}</span>,
        cell: ({ row }) => {
          const level = levelByStudent.get(row.original.userId);
          if (!level) return null;
          return (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setRecordingStudent({
                  userId: row.original.userId,
                  displayName: getRosterDisplayName(row.original, unnamed, nameFormat),
                  rosterNumber: row.original.rosterNumber,
                  currentLevel: level.currentLevel,
                });
              }}
            >
              {t("recordAction")}
            </Button>
          );
        },
      });
    }

    return cols;
  }, [
    canManage,
    classId,
    i18n.language,
    levelByStudent,
    levelsHidden,
    nameFormat,
    setManualStatus,
    statusByStudent,
    t,
    unnamed,
  ]);

  const setupIncomplete = canManage && canReadStudents && total > 0 && remaining > 0;
  const loading =
    permissionsPending ||
    levelsPending ||
    (canReadStudents && rosterPending && roster === undefined);

  const showSearch =
    !loading && canReadStudents && (students.length > 0 || searchQuery.trim().length > 0);
  const showNoMatches =
    !loading &&
    canReadStudents &&
    students.length > 0 &&
    filtered.length === 0 &&
    (searchQuery.trim().length > 0 || selectedStatuses.length > 0);

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full max-w-2xl" />
        <Skeleton className="h-40 w-full max-w-xl" />
      </div>
    );
  }

  if (levelsError || (canReadStudents && rosterError)) {
    return (
      <div className="px-4 py-8 sm:px-8">
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedDescription")}
          onRetry={() => {
            void refetchLevels();
            if (canReadStudents) void refetchRoster();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
      </div>

      <aside className="max-w-2xl rounded-2xl border bg-muted/40 p-4 sm:p-5">
        <h2 className="text-base font-semibold tracking-tight">{t("statusTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("statusDescription")}</p>
        <div className="mt-3 flex flex-col gap-1.5 text-sm sm:flex-row sm:flex-wrap sm:gap-x-4">
          <a
            href={ASSESS_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("statusAssessLink")}
            <ExternalLink className="size-3" aria-hidden />
          </a>
          <a
            href={CHART_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("statusChartLink")}
            <ExternalLink className="size-3" aria-hidden />
          </a>
        </div>
      </aside>

      {!canReadStudents ? (
        <p className="text-sm text-muted-foreground">{tCommon("unauthorizedDescription")}</p>
      ) : students.length === 0 ? (
        <Empty className="max-w-xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpen />
            </EmptyMedia>
            <EmptyTitle>{t("studentsEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("studentsEmptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {showSearch ? (
              <InputGroup className="max-w-md">
                <InputGroupInput
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t("searchPlaceholder")}
                  aria-label={t("searchLabel")}
                  autoComplete="off"
                  spellCheck={false}
                />
                <InputGroupAddon>
                  <SearchIcon aria-hidden="true" />
                </InputGroupAddon>
                <InputGroupAddon align="inline-end">
                  <InputGroupText>{t("searchResults", { count: filtered.length })}</InputGroupText>
                  {searchQuery ? (
                    <InputGroupButton
                      size="icon-xs"
                      aria-label={t("searchClear")}
                      onClick={() => setSearchQuery("")}
                    >
                      <XIcon />
                    </InputGroupButton>
                  ) : null}
                </InputGroupAddon>
              </InputGroup>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-pressed={levelsHidden}
                aria-label={levelsHidden ? t("showLevels") : t("hideLevels")}
                onClick={() => setLevelsHidden((prev) => !prev)}
              >
                {levelsHidden ? (
                  <EyeOffIcon data-icon="inline-start" />
                ) : (
                  <EyeIcon data-icon="inline-start" />
                )}
                {levelsHidden ? t("showLevels") : t("hideLevels")}
              </Button>
              <RosterColumnVisibilityMenu
                columnOrder={columnOrder}
                columnVisibility={columnVisibility}
                onColumnVisibilityChange={setColumnVisibility}
              />
            </div>
          </div>

          <ToggleGroup
            variant="outline"
            spacing={0}
            value={selectedStatuses}
            onValueChange={(values) => {
              setSelectedStatuses(values.filter(isRazDisplayStatus));
            }}
            aria-label={t("statusFilterLabel")}
            className="flex max-w-full flex-wrap"
          >
            {RAZ_DISPLAY_STATUSES.map((status) => (
              <ToggleGroupItem key={status} value={status} className="px-3">
                {t(STATUS_I18N_KEY[status])}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          {showNoMatches ? (
            <Empty className="max-w-xl border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchIcon />
                </EmptyMedia>
                <EmptyTitle>{t("searchNoResultsTitle")}</EmptyTitle>
                <EmptyDescription>{t("searchNoResults")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <RosterTable
              data={filtered}
              columnOrder={columnOrder}
              columnVisibility={columnVisibility}
              extraColumns={extraColumns}
            />
          )}
        </div>
      )}

      <RazRecordAssessmentCredenza
        open={recordingStudent !== null}
        onOpenChange={(next) => {
          if (!next) setRecordingStudent(null);
        }}
        student={recordingStudent}
        onSubmit={async (args) => {
          await recordAssessment.mutateAsync({
            classId,
            ...args,
          });
        }}
      />

      <AlertDialog
        open={setupIncomplete}
        onOpenChange={() => {
          /* Non-dismissable while setup is incomplete. */
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("setupTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("setupDescription")} {t("setupProgress", { set: setCount, total })}
            </AlertDialogDescription>
            <Badge variant="secondary" className="w-fit tabular-nums">
              {t("setupProgressChip", { set: setCount, total })}
            </Badge>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                void navigate({
                  to: "/class/$classId/raz/initial-levels",
                  params: { classId },
                });
              }}
            >
              {t("setupAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
