import { BookOpen, UsersIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { DataTableSortableHeader } from "@/components/feedback/DataTableSortableHeader";
import { PersonalStudentPicker } from "@/components/personal/PersonalStudentPicker";
import { RazSummaryContent } from "@/components/raz/RazSummaryContent";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useRazAssessmentHistoryForAudience } from "@/hooks/raz/useRazAssessmentHistoryForAudience";
import { useRazForAudience } from "@/hooks/raz/useRazForAudience";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { toIntlLocale } from "@/lib/languages";
import {
  getRosterDisplayName,
  resolveRosterNameFormat,
  type RosterNameFormat,
} from "@/lib/roster/roster";
import { getInitials } from "@/lib/user/userDisplay";
import { sanitizeAvatarUrl } from "../../../convex/lib/avatarUrl";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { GC_TIME } from "@/lib/queryCache";

const RESULT_I18N_KEY = {
  level_up: "resultLevelUp",
  stay: "resultStay",
  level_down: "resultLevelDown",
} as const;

type HistorySortKey = "date" | "level" | "result" | "read" | "retell" | "respond";
type SortDirection = "asc" | "desc";

type PersonalRazPageProps = {
  classId: Id<"classes">;
};

type PersonalRazStudent = NonNullable<ReturnType<typeof useRazForAudience>["data"]>[number];
type PersonalRazAssessment = NonNullable<
  ReturnType<typeof useRazAssessmentHistoryForAudience>["data"]
>[number];

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

function compareNullableNumber(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

function sortAssessments(
  items: PersonalRazAssessment[],
  sortKey: HistorySortKey,
  sortDirection: SortDirection,
): PersonalRazAssessment[] {
  const sorted = [...items];
  const dir = sortDirection === "asc" ? 1 : -1;
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "date":
        cmp = a.assessedAt - b.assessedAt;
        break;
      case "level":
        cmp = a.level.localeCompare(b.level);
        break;
      case "result":
        cmp = a.result.localeCompare(b.result);
        break;
      case "read":
        cmp = a.readAccuracy - b.readAccuracy;
        break;
      case "retell":
        cmp = compareNullableNumber(a.retellScore, b.retellScore);
        break;
      case "respond":
        cmp = a.respondScore - b.respondScore;
        break;
    }
    return cmp * dir;
  });
  return sorted;
}

type SummaryCardProps = {
  student: PersonalRazStudent;
  nameFormat: RosterNameFormat;
  language: string;
};

function PersonalRazSummaryCard({ student, nameFormat, language }: SummaryCardProps) {
  const { t: tClasses } = useTranslation("classes");
  const displayName = getRosterDisplayName(student, tClasses("unnamedMember"), nameFormat);
  const initials = getInitials({
    _id: student.userId,
    name: displayName,
    email: student.email,
  });
  const avatarSrc = sanitizeAvatarUrl(student.image);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <Avatar size="lg">
          {avatarSrc ? <AvatarImage src={avatarSrc} alt="" /> : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums">
              {student.rosterNumber}
            </span>
            <p className="truncate font-medium">{displayName}</p>
          </div>
        </div>
      </div>

      <RazSummaryContent student={student} language={language} />
    </div>
  );
}

export function PersonalRazPage({ classId }: PersonalRazPageProps) {
  const { t, i18n } = useTranslation("raz");
  const { data: classDoc } = useAuthedQuery(
    api.classes.get,
    { classId },
    { gcTime: GC_TIME.stable },
  );
  const { data, isPending, isError, refetch } = useRazForAudience(classId);
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(null);
  const [sortKey, setSortKey] = useState<HistorySortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const nameFormat = resolveRosterNameFormat(classDoc ?? {});
  const students = data ?? [];
  const activeStudentId =
    selectedUserId && students.some((student) => student.userId === selectedUserId)
      ? selectedUserId
      : (students[0]?.userId ?? null);
  const activeStudent =
    activeStudentId != null
      ? (students.find((student) => student.userId === activeStudentId) ?? null)
      : null;

  const history = useRazAssessmentHistoryForAudience(classId, activeStudentId);
  const visibleAssessments = useMemo(
    () => sortAssessments(history.data ?? [], sortKey, sortDirection),
    [history.data, sortKey, sortDirection],
  );

  useEffect(() => {
    setSortKey("date");
    setSortDirection("desc");
  }, [activeStudentId]);

  const onHistorySort = (key: HistorySortKey) => {
    const next = nextSortState(sortKey, sortDirection, key);
    setSortKey(next.sortKey);
    setSortDirection(next.sortDirection);
  };

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("personalTitle")}</h1>
        <p className="hidden text-muted-foreground sm:block">{t("personalDescription")}</p>
      </div>

      {isPending ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Skeleton className="h-56 w-full rounded-2xl" />
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
        <Empty card>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>{t("personalStudentsEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("personalStudentsEmptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {!isPending && !isError && students.length > 0 && activeStudent != null ? (
        <>
          {students.length > 1 ? (
            <PersonalStudentPicker
              students={students}
              selectedUserId={activeStudent.userId}
              nameFormat={nameFormat}
              onSelect={setSelectedUserId}
            />
          ) : null}

          <PersonalRazSummaryCard
            student={activeStudent}
            nameFormat={nameFormat}
            language={i18n.language}
          />

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <BookOpen className="size-3.5 shrink-0" aria-hidden />
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

            {history.isError ? (
              <ErrorState
                title={t("historyLoadFailed")}
                description={t("loadFailedDescription")}
                onRetry={() => void history.refetch()}
              />
            ) : null}

            {!history.isPending && !history.isError && (history.data?.length ?? 0) === 0 ? (
              <p className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                {t("historyEmpty")}
              </p>
            ) : null}

            {!history.isPending && !history.isError && visibleAssessments.length > 0 ? (
              <div className="rounded-2xl ring-1 ring-foreground/10">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <DataTableSortableHeader
                          label={t("dateLabel")}
                          sorted={sortKey === "date" ? sortDirection : false}
                          onSort={() => onHistorySort("date")}
                        />
                      </TableHead>
                      <TableHead>
                        <DataTableSortableHeader
                          label={t("levelLabel")}
                          sorted={sortKey === "level" ? sortDirection : false}
                          onSort={() => onHistorySort("level")}
                        />
                      </TableHead>
                      <TableHead>
                        <DataTableSortableHeader
                          label={t("resultLabel")}
                          sorted={sortKey === "result" ? sortDirection : false}
                          onSort={() => onHistorySort("result")}
                        />
                      </TableHead>
                      <TableHead>
                        <DataTableSortableHeader
                          label={t("readLabel")}
                          sorted={sortKey === "read" ? sortDirection : false}
                          onSort={() => onHistorySort("read")}
                        />
                      </TableHead>
                      <TableHead>
                        <DataTableSortableHeader
                          label={t("retellLabel")}
                          sorted={sortKey === "retell" ? sortDirection : false}
                          onSort={() => onHistorySort("retell")}
                        />
                      </TableHead>
                      <TableHead>
                        <DataTableSortableHeader
                          label={t("respondLabel")}
                          sorted={sortKey === "respond" ? sortDirection : false}
                          onSort={() => onHistorySort("respond")}
                        />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleAssessments.map((assessment) => (
                      <TableRow key={assessment._id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                          {formatMediumDateTime(assessment.assessedAt, i18n.language)}
                        </TableCell>
                        <TableCell className="font-medium tabular-nums">
                          {assessment.level}
                        </TableCell>
                        <TableCell>{t(RESULT_I18N_KEY[assessment.result])}</TableCell>
                        <TableCell className="tabular-nums">{assessment.readAccuracy}%</TableCell>
                        <TableCell className="tabular-nums">
                          {assessment.retellScore == null ? "—" : assessment.retellScore}
                        </TableCell>
                        <TableCell className="tabular-nums">{assessment.respondScore}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
