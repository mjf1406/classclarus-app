import { useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { BookOpen, ExternalLink } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { DataTableSortableHeader } from "@/components/feedback/DataTableSortableHeader";
import { RosterColumnVisibilityMenu } from "@/components/roster/RosterColumnVisibilityMenu";
import { RosterTable } from "@/components/roster/RosterTable";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useRazInitialLevels } from "@/hooks/raz/useRazInitialLevels";
import { useSetRazInitialLevel } from "@/hooks/raz/useSetRazInitialLevel";
import { useClassUserSettings } from "@/hooks/roster/useClassUserSettings";
import { useEnsureStudentRosters } from "@/hooks/roster/useEnsureStudentRosters";
import { useRosterConsumerColumnVisibility } from "@/hooks/roster/useRosterConsumerColumnVisibility";
import { useStudentRoster } from "@/hooks/roster/useStudentRoster";
import { isRazLevel, RAZ_LEVEL_KEYS } from "@/lib/raz/levels";
import {
  getRosterDisplayName,
  normalizeColumnOrder,
  normalizeColumnVisibility,
  resolveRosterNameFormat,
  type StudentRosterEntry,
} from "@/lib/roster/roster";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { GC_TIME } from "@/lib/queryCache";

const RAZ_INITIAL_LEVELS_SURFACE = "raz-initial-levels";
const CHART_URL = "https://www.raz-kids.com/main/ViewPage/name/level-correlation-chart/";

type RazInitialLevelsPageProps = {
  classId: Id<"classes">;
};

export function RazInitialLevelsPage({ classId }: RazInitialLevelsPageProps) {
  const { t } = useTranslation("raz");
  const { t: tClasses } = useTranslation("classes");
  const navigate = useNavigate();

  const {
    data: roster,
    isPending: rosterPending,
    isError: rosterError,
    refetch: refetchRoster,
    isAuthLoading,
  } = useStudentRoster(classId);
  const {
    data: levels,
    isPending: levelsPending,
    isError: levelsError,
    refetch: refetchLevels,
  } = useRazInitialLevels(classId);
  const { data: settings } = useClassUserSettings(classId);
  const { data: classDoc } = useAuthedQuery(
    api.classes.get,
    { classId },
    { gcTime: GC_TIME.stable },
  );
  const setLevel = useSetRazInitialLevel();

  useEnsureStudentRosters(classId, !rosterPending && !isAuthLoading && !rosterError);

  const nameFormat = resolveRosterNameFormat(classDoc ?? {});
  const unnamed = tClasses("unnamedMember");

  const levelByStudent = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of levels ?? []) {
      map.set(row.studentUserId, row.initialLevel);
    }
    return map;
  }, [levels]);

  const students = roster ?? [];
  const allComplete =
    students.length === 0 || students.every((student) => levelByStudent.has(student.userId));

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
    RAZ_INITIAL_LEVELS_SURFACE,
    baseColumnVisibility,
  );

  const levelColumns = useMemo((): ColumnDef<StudentRosterEntry, unknown>[] => {
    return [
      {
        id: "razLevel",
        accessorFn: (student) => levelByStudent.get(student.userId) ?? "",
        header: ({ column }) => (
          <DataTableSortableHeader
            label={t("columnLevel")}
            sorted={column.getIsSorted()}
            onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => {
          const student = row.original;
          const current = levelByStudent.get(student.userId);
          const displayName = getRosterDisplayName(student, unnamed, nameFormat);
          return (
            <Select
              value={current ?? null}
              onValueChange={(next) => {
                if (typeof next !== "string" || !isRazLevel(next) || next === current) return;
                void setLevel.mutateAsync({
                  classId,
                  studentUserId: student.userId,
                  initialLevel: next,
                });
              }}
            >
              <SelectTrigger
                className="min-w-28"
                size="sm"
                aria-label={`${t("columnLevel")}: ${displayName}`}
              >
                <SelectValue placeholder={t("levelPlaceholder")}>
                  {current ?? t("levelPlaceholder")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {RAZ_LEVEL_KEYS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          );
        },
        sortingFn: (rowA, rowB) => {
          const a = levelByStudent.get(rowA.original.userId) ?? "";
          const b = levelByStudent.get(rowB.original.userId) ?? "";
          return a.localeCompare(b, undefined, { sensitivity: "base" });
        },
        enableSorting: true,
      },
    ];
  }, [classId, levelByStudent, nameFormat, setLevel, t, unnamed]);

  if (rosterPending || levelsPending) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-6 w-72" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (rosterError || levelsError) {
    return (
      <div className="px-4 py-8 sm:px-8">
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedDescription")}
          onRetry={() => {
            void refetchRoster();
            void refetchLevels();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("initialLevelsTitle")}
        </h1>
        <p className="text-muted-foreground">
          {t("initialLevelsDescription")} {t("initialLevelsChartHelp")}{" "}
          <a
            href={CHART_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("statusChartLink")}
            <ExternalLink className="size-3" aria-hidden />
          </a>
          .
        </p>
      </div>

      {students.length === 0 ? (
        <Empty card>
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
          <div className="flex justify-end">
            <RosterColumnVisibilityMenu
              columnOrder={columnOrder}
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={setColumnVisibility}
            />
          </div>
          <RosterTable
            data={students}
            columnOrder={columnOrder}
            columnVisibility={columnVisibility}
            extraColumns={levelColumns}
          />
        </div>
      )}

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
        {!allComplete ? (
          <p className="text-sm text-muted-foreground sm:mr-auto">{t("allDoneDisabledHint")}</p>
        ) : null}
        <Button
          type="button"
          disabled={!allComplete}
          onClick={() => {
            if (!allComplete) return;
            void navigate({ to: "/class/$classId/raz", params: { classId } });
          }}
        >
          {t("allDone")}
        </Button>
      </div>
    </div>
  );
}
