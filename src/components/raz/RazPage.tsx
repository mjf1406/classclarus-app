import { useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { BookOpen, ExternalLink } from "lucide-react";
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useCan } from "@/hooks/permissions/useCan";
import { useRazInitialLevels } from "@/hooks/raz/useRazInitialLevels";
import { useRecordRazAssessment } from "@/hooks/raz/useRecordRazAssessment";
import { useClassUserSettings } from "@/hooks/roster/useClassUserSettings";
import { useEnsureStudentRosters } from "@/hooks/roster/useEnsureStudentRosters";
import { useRosterConsumerColumnVisibility } from "@/hooks/roster/useRosterConsumerColumnVisibility";
import { useStudentRoster } from "@/hooks/roster/useStudentRoster";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { ONE_HOUR } from "@/lib/queryCache";
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

type RazPageProps = {
  classId: Id<"classes">;
};

export function RazPage({ classId }: RazPageProps) {
  const { t } = useTranslation("raz");
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

  useEnsureStudentRosters(classId, !rosterPending && !isAuthLoading && !rosterError);

  const [recordingStudent, setRecordingStudent] = useState<RazRecordAssessmentStudent | null>(null);

  const nameFormat = resolveRosterNameFormat(classDoc ?? {});
  const unnamed = tClasses("unnamedMember");

  const levelByStudent = useMemo(() => {
    const map = new Map<string, { initialLevel: string; currentLevel: string }>();
    for (const row of levels ?? []) {
      map.set(row.studentUserId, {
        initialLevel: row.initialLevel,
        currentLevel: row.currentLevel,
      });
    }
    return map;
  }, [levels]);

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
          return level ? (
            <span className="font-medium tabular-nums">{level}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
        sortingFn: (rowA, rowB) => {
          const a = levelByStudent.get(rowA.original.userId)?.currentLevel ?? "";
          const b = levelByStudent.get(rowB.original.userId)?.currentLevel ?? "";
          return a.localeCompare(b, undefined, { sensitivity: "base" });
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
  }, [canManage, levelByStudent, nameFormat, t, unnamed]);

  const setupIncomplete = canManage && canReadStudents && total > 0 && remaining > 0;
  const loading =
    permissionsPending ||
    levelsPending ||
    (canReadStudents && rosterPending && roster === undefined);

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
            extraColumns={extraColumns}
          />
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
