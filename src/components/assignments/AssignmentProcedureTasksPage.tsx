import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, ListTodo } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { DataTableSortableHeader } from "@/components/feedback/DataTableSortableHeader";
import { GroupTeamFilterButtons } from "@/components/groups/GroupTeamFilterButtons";
import { RosterColumnVisibilityMenu } from "@/components/roster/RosterColumnVisibilityMenu";
import { RosterTable } from "@/components/roster/RosterTable";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssignmentProcedureTaskCompletions } from "@/hooks/assignments/useAssignmentProcedureTaskCompletions";
import { useGroupTeamFilterState } from "@/hooks/groups/useGroupTeamFilterState";
import { useGroupsBoard } from "@/hooks/groups/useGroupsBoard";
import { useCan } from "@/hooks/permissions/useCan";
import { useClassUserSettings } from "@/hooks/roster/useClassUserSettings";
import { useEnsureStudentRosters } from "@/hooks/roster/useEnsureStudentRosters";
import { useRosterConsumerColumnVisibility } from "@/hooks/roster/useRosterConsumerColumnVisibility";
import { useStudentRoster } from "@/hooks/roster/useStudentRoster";
import { useStudentRosterFilter } from "@/hooks/students/useStudentRosterFilter";
import { useSetTaskCompletion } from "@/hooks/tasks/useSetTaskCompletion";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { buildMembershipIndex } from "@/lib/groups/groupTeamFilters";
import { collectAllStudents, sortStudents } from "@/lib/groups/groups";
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

const PROCEDURE_TASKS_ROSTER_SURFACE = "assignment-procedure-tasks";
const STEP_HEADER_MAX_LENGTH = 40;

type AssignmentProcedureTasksPageProps = {
  classId: Id<"classes">;
  assignmentId: Id<"assignments">;
};

function truncateStepBody(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length <= STEP_HEADER_MAX_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, STEP_HEADER_MAX_LENGTH - 1)}…`;
}

export function AssignmentProcedureTasksPage({
  classId,
  assignmentId,
}: AssignmentProcedureTasksPageProps) {
  const { t } = useTranslation("assignments");
  const { t: tClasses } = useTranslation("classes");
  const { can } = useCan();
  const canComplete = can("tasks:complete");
  const unnamed = tClasses("unnamedMember");

  const { data, isPending, isError, refetch } = useAssignmentProcedureTaskCompletions(
    classId,
    assignmentId,
  );
  const { data: classDoc } = useAuthedQuery(api.classes.get, { classId }, { gcTime: ONE_HOUR });
  const {
    data: groupsBoard,
    isPending: boardPending,
    isError: boardError,
    refetch: refetchBoard,
  } = useGroupsBoard(classId);
  const {
    data: roster,
    isPending: rosterPending,
    isError: rosterError,
    refetch: refetchRoster,
    isAuthLoading,
  } = useStudentRoster(classId);
  const { data: settings } = useClassUserSettings(classId);
  const groupTeamFilterState = useGroupTeamFilterState(classId);
  const setCompletion = useSetTaskCompletion();

  useEnsureStudentRosters(classId, !rosterPending && !isAuthLoading && !rosterError);

  const nameFormat = useMemo(
    () =>
      resolveRosterNameFormat({
        rosterNameOrder: classDoc?.rosterNameOrder,
        rosterNameSpace: classDoc?.rosterNameSpace,
      }),
    [classDoc?.rosterNameOrder, classDoc?.rosterNameSpace],
  );

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
    PROCEDURE_TASKS_ROSTER_SURFACE,
    baseColumnVisibility,
  );

  const students = useMemo((): StudentRosterEntry[] => {
    if (roster !== undefined) {
      return roster;
    }
    if (!groupsBoard) return [];
    return sortStudents(collectAllStudents(groupsBoard), nameFormat).map((student, index) => ({
      userId: student.userId,
      rosterNumber: index + 1,
      firstName: student.firstName,
      lastName: student.lastName,
      name: student.name,
      email: student.email,
      role: "student" as const,
    }));
  }, [groupsBoard, nameFormat, roster]);

  const membershipByUserId = useMemo(
    () => (groupsBoard ? buildMembershipIndex(groupsBoard) : {}),
    [groupsBoard],
  );
  const filterState = useMemo(
    () => ({
      groupIds: groupTeamFilterState.groupIds,
      teamIds: groupTeamFilterState.teamIds,
      includeUngrouped: groupTeamFilterState.includeUngrouped,
    }),
    [
      groupTeamFilterState.groupIds,
      groupTeamFilterState.teamIds,
      groupTeamFilterState.includeUngrouped,
    ],
  );
  const { filtered } = useStudentRosterFilter({
    members: students,
    query: "",
    membershipByUserId,
    filterState,
  });

  const completedSetsByTaskId = useMemo(() => {
    const map = new Map<Id<"tasks">, Set<Id<"users">>>();
    for (const entry of data?.completionsByTaskId ?? []) {
      map.set(entry.taskId, new Set(entry.completedStudentIds));
    }
    return map;
  }, [data?.completionsByTaskId]);

  const stepColumns = useMemo((): ColumnDef<StudentRosterEntry, unknown>[] => {
    if (!data) {
      return [];
    }
    return data.steps.map((step) => {
      const completedSet = completedSetsByTaskId.get(step.taskId) ?? new Set<Id<"users">>();
      const headerLabel = t("procedureTaskStepColumn", {
        number: step.stepNumber,
        body: truncateStepBody(step.body),
      });
      return {
        id: `procedureTask:${step.taskId}`,
        accessorFn: (student) => completedSet.has(student.userId),
        header: ({ column }) => (
          <div className="flex justify-center">
            <DataTableSortableHeader
              label={headerLabel}
              sorted={column.getIsSorted()}
              onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
            />
          </div>
        ),
        cell: ({ row }) => {
          const student = row.original;
          const completed = completedSet.has(student.userId);
          const displayName = getRosterDisplayName(student, unnamed, nameFormat);
          return (
            <div className="flex justify-center">
              <Checkbox
                checked={completed}
                disabled={!canComplete || setCompletion.isPending}
                aria-label={t("procedureTaskCompleteAria", {
                  name: displayName,
                  number: step.stepNumber,
                })}
                onCheckedChange={(value) => {
                  if (!canComplete) return;
                  const next = value === true;
                  if (next === completed) return;
                  void setCompletion.mutateAsync({
                    classId,
                    taskId: step.taskId,
                    studentUserId: student.userId,
                    completed: next,
                    assignmentId,
                  });
                }}
              />
            </div>
          );
        },
        sortingFn: (rowA, rowB) =>
          Number(completedSet.has(rowA.original.userId)) -
          Number(completedSet.has(rowB.original.userId)),
        enableSorting: true,
      };
    });
  }, [
    assignmentId,
    canComplete,
    classId,
    completedSetsByTaskId,
    data,
    nameFormat,
    setCompletion,
    t,
    unnamed,
  ]);

  const loading = isPending || boardPending || rosterPending || isAuthLoading;

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || boardError || rosterError) {
    return (
      <div className="px-4 py-8 sm:px-8">
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedDescription")}
          onRetry={() => {
            void refetch();
            void refetchBoard();
            void refetchRoster();
          }}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <Button
          type="button"
          variant="ghost"
          className="w-fit"
          render={
            <Link
              to="/class/$classId/assignments/$assignmentId"
              params={{ classId, assignmentId }}
            />
          }
        >
          <ArrowLeft className="size-4" />
          {t("backToAssignment")}
        </Button>
        <ErrorState title={t("notFoundTitle")} description={t("notFoundDescription")} />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-8 sm:px-8">
      <Button
        type="button"
        variant="ghost"
        className="w-fit"
        render={
          <Link to="/class/$classId/assignments/$assignmentId" params={{ classId, assignmentId }} />
        }
      >
        <ArrowLeft className="size-4" />
        {t("backToAssignment")}
      </Button>

      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="truncate text-2xl font-semibold tracking-tight" title={data.assignmentName}>
          {data.assignmentName}
        </h1>
        <p className="text-muted-foreground text-sm">{t("procedureTasksTitle")}</p>
      </div>

      <GroupTeamFilterButtons classId={classId} />

      {data.steps.length === 0 ? (
        <Empty card>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListTodo />
            </EmptyMedia>
            <EmptyTitle>{t("procedureTasksEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("procedureTasksEmptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : filtered.length === 0 ? (
        <Empty card>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListTodo />
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
            data={filtered}
            columnOrder={columnOrder}
            columnVisibility={columnVisibility}
            extraColumns={stepColumns}
          />
        </div>
      )}
    </div>
  );
}
