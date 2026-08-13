import { ClipboardCheck, UsersIcon, XIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { AsyncButton } from "@/components/ui/async-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useAttendanceForAudience } from "@/hooks/attendance/useAttendanceForAudience";
import { useAttendanceHistoryForAudience } from "@/hooks/attendance/useAttendanceHistoryForAudience";
import { useAttendanceSummaryForAudience } from "@/hooks/attendance/useAttendanceSummaryForAudience";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import type { AttendanceDraftStatus, AttendanceStatusSummary } from "@/lib/attendance/attendance";
import { localDateKey } from "@/lib/attendance/dateKey";
import { toIntlLocale } from "@/lib/languages";
import { ONE_HOUR } from "@/lib/queryCache";
import {
  getRosterDisplayName,
  resolveRosterNameFormat,
  type RosterNameFormat,
} from "@/lib/roster/roster";
import { getInitials } from "@/lib/user/userDisplay";
import { cn } from "@/lib/utils";
import { sanitizeAvatarUrl } from "../../../convex/lib/avatarUrl";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const STATUS_CARD_CLASS: Record<AttendanceDraftStatus, string> = {
  unset: "border-border bg-card",
  present: "border-emerald-500/50 bg-emerald-500/10",
  absent: "border-destructive/50 bg-destructive/10",
  late: "border-amber-500/50 bg-amber-500/10",
};

const STATUS_BADGE_CLASS: Record<AttendanceDraftStatus, string> = {
  unset: "bg-muted text-muted-foreground",
  present: "bg-emerald-600 text-white",
  absent: "bg-destructive text-destructive-foreground",
  late: "bg-amber-600 text-white",
};

const EMPTY_SUMMARY: AttendanceStatusSummary = {
  present: 0,
  absent: 0,
  late: 0,
  total: 0,
  percentPresent: 0,
  ratio: { present: 0, absent: 0 },
};

type PersonalAttendancePageProps = {
  classId: Id<"classes">;
};

type PersonalStudent = {
  userId: Id<"users">;
  rosterNumber: number;
  firstName?: string;
  lastName?: string;
  name?: string;
  image?: string;
  email?: string;
  status?: "present" | "absent" | "late";
};

type PersonalStudentCardProps = {
  student: PersonalStudent;
  nameFormat: RosterNameFormat;
  summary: AttendanceStatusSummary | null;
  summaryPending: boolean;
};

function statusLabelKey(
  status: AttendanceDraftStatus,
): "statusUnset" | "statusPresent" | "statusAbsent" | "statusLate" {
  if (status === "present") return "statusPresent";
  if (status === "absent") return "statusAbsent";
  if (status === "late") return "statusLate";
  return "statusUnset";
}

function formatDateKey(dateKey: string, language: string): string {
  const locale = toIntlLocale(language);
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

function toggleStudentFilter(
  current: Set<Id<"users">>,
  studentUserId: Id<"users">,
): Set<Id<"users">> {
  const next = new Set(current);
  if (next.has(studentUserId)) next.delete(studentUserId);
  else next.add(studentUserId);
  return next;
}

function PersonalAttendanceStudentCard({
  student,
  nameFormat,
  summary,
  summaryPending,
}: PersonalStudentCardProps) {
  const { t } = useTranslation("attendance");
  const { t: tClasses } = useTranslation("classes");
  const displayName = getRosterDisplayName(student, tClasses("unnamedMember"), nameFormat);
  const status: AttendanceDraftStatus = student.status ?? "unset";
  const statusLabel = t(statusLabelKey(status));
  const initials = getInitials({
    _id: student.userId,
    name: displayName,
    email: student.email,
  });
  const safeImage = sanitizeAvatarUrl(student.image);
  const stats = summary ?? EMPTY_SUMMARY;

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-3 rounded-2xl border p-4 text-left",
        STATUS_CARD_CLASS[status],
      )}
    >
      <div className="flex items-center gap-3">
        <Avatar size="lg">
          {safeImage ? <AvatarImage src={safeImage} alt="" /> : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums">
              {student.rosterNumber}
            </span>
            <p className="truncate font-medium">{displayName}</p>
          </div>
          <span
            className={cn(
              "mt-1 inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
              STATUS_BADGE_CLASS[status],
            )}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {summaryPending ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{t("statusPresent")}</span>
            <span className="text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
              {stats.present}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{t("statusAbsent")}</span>
            <span className="text-lg font-semibold tabular-nums text-destructive">
              {stats.absent}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{t("summaryPercentLabel")}</span>
            <span className="text-lg font-semibold tabular-nums">
              {t("summaryPercentValue", { percent: stats.percentPresent })}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{t("summaryRatioLabel")}</span>
            <span
              className="text-lg font-semibold tabular-nums"
              aria-label={t("summaryRatioAria", {
                present: stats.ratio.present,
                absent: stats.ratio.absent,
              })}
            >
              {t("summaryRatioValue", {
                present: stats.ratio.present,
                absent: stats.ratio.absent,
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

type NameFilterButtonProps = {
  label: string;
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
};

function NameFilterButton({ label, pressed, onClick, children }: NameFilterButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="sm"
            variant={pressed ? "default" : "outline"}
            aria-pressed={pressed}
            onClick={onClick}
            className="h-7 max-w-36 shrink-0 px-2"
          />
        }
      >
        <span aria-hidden="true" className="truncate">
          {children}
        </span>
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export function PersonalAttendancePage({ classId }: PersonalAttendancePageProps) {
  const { t, i18n } = useTranslation("attendance");
  const { t: tClasses } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const dateKey = useMemo(() => localDateKey(), []);
  const { data: classDoc } = useAuthedQuery(api.classes.get, { classId }, { gcTime: ONE_HOUR });
  const { data, isPending, isError, refetch } = useAttendanceForAudience(classId, dateKey);
  const attendanceSummary = useAttendanceSummaryForAudience(classId);
  const [studentFilters, setStudentFilters] = useState<Set<Id<"users">>>(() => new Set());

  const nameFormat = useMemo(
    () =>
      resolveRosterNameFormat({
        rosterNameOrder: classDoc?.rosterNameOrder,
        rosterNameSpace: classDoc?.rosterNameSpace,
      }),
    [classDoc?.rosterNameOrder, classDoc?.rosterNameSpace],
  );

  const students = data?.students ?? [];
  const showNameColumn = students.length > 1;
  const filtersActive = studentFilters.size > 0;

  const nameByUserId = new Map(
    students.map((student) => [
      student.userId,
      getRosterDisplayName(student, tClasses("unnamedMember"), nameFormat),
    ]),
  );

  const history = useAttendanceHistoryForAudience(classId);

  const visibleHistoryItems = filtersActive
    ? history.items.filter((item) => studentFilters.has(item.studentUserId))
    : history.items;

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("personalTitle")}</h1>
        <p className="hidden text-muted-foreground sm:block">
          {t("personalDescription", { date: dateKey })}
        </p>
      </div>

      {isPending ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="h-40 w-full rounded-2xl" />
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
                <PersonalAttendanceStudentCard
                  student={student}
                  nameFormat={nameFormat}
                  summary={attendanceSummary.byStudentId.get(student.userId) ?? null}
                  summaryPending={attendanceSummary.isPending}
                />
              </li>
            ))}
          </ul>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ClipboardCheck className="size-3.5 shrink-0" aria-hidden />
            {t("personalReadOnlyHint")}
          </p>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium tracking-tight">{t("historyTitle")}</h2>

            {history.isPending ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ) : null}

            {history.isRefreshing ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner className="size-3.5" aria-label={tCommon("loading")} />
                {tCommon("loading")}
              </p>
            ) : null}

            {history.isError ? (
              <ErrorState
                title={t("historyLoadFailed")}
                description={t("loadFailedDescription")}
                onRetry={() => void history.refetch()}
              />
            ) : null}

            {!history.isPending && !history.isError && history.items.length === 0 ? (
              <p className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                {t("historyEmpty")}
              </p>
            ) : null}

            {!history.isPending && !history.isError && history.items.length > 0 ? (
              <div className="rounded-2xl ring-1 ring-foreground/10">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("historyDate")}</TableHead>
                      {showNameColumn ? (
                        <TableHead>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span>{t("historyName")}</span>
                            <div className="flex flex-wrap items-center gap-1">
                              {students.map((student) => {
                                const label = nameByUserId.get(student.userId) ?? student.userId;
                                return (
                                  <NameFilterButton
                                    key={student.userId}
                                    label={t("historyFilterStudentAria", { name: label })}
                                    pressed={studentFilters.has(student.userId)}
                                    onClick={() =>
                                      setStudentFilters((current) =>
                                        toggleStudentFilter(current, student.userId),
                                      )
                                    }
                                  >
                                    {label}
                                  </NameFilterButton>
                                );
                              })}
                              {filtersActive ? (
                                <NameFilterButton
                                  label={t("historyFilterClear")}
                                  pressed={false}
                                  onClick={() => setStudentFilters(new Set())}
                                >
                                  <XIcon className="size-3.5" />
                                </NameFilterButton>
                              ) : null}
                            </div>
                          </div>
                        </TableHead>
                      ) : null}
                      <TableHead>{t("historyStatus")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleHistoryItems.map((item) => (
                      <TableRow key={`${item.dateKey}-${item.studentUserId}`}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {formatDateKey(item.dateKey, i18n.language)}
                        </TableCell>
                        {showNameColumn ? (
                          <TableCell className="font-medium">
                            {nameByUserId.get(item.studentUserId) ?? tClasses("unnamedMember")}
                          </TableCell>
                        ) : null}
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                              STATUS_BADGE_CLASS[item.status],
                            )}
                          >
                            {t(statusLabelKey(item.status))}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {visibleHistoryItems.length === 0 ? (
                  <p className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
                    {t("historyFilterNoResults")}
                  </p>
                ) : null}
              </div>
            ) : null}

            {history.hasNextPage ? (
              <AsyncButton
                type="button"
                variant="outline"
                className="self-center"
                pending={history.isFetchingNextPage}
                onClick={async () => {
                  await history.fetchNextPage();
                }}
              >
                {t("historyLoadMore")}
              </AsyncButton>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
