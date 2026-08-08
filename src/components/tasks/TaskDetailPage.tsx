import { Link, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, ListTodo, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { DataTableSortableHeader } from "@/components/feedback/DataTableSortableHeader";
import { DeleteNamedCredenza } from "@/components/groups/DeleteNamedCredenza";
import { GroupTeamFilterButtons } from "@/components/groups/GroupTeamFilterButtons";
import { RosterColumnVisibilityMenu } from "@/components/roster/RosterColumnVisibilityMenu";
import { RosterTable } from "@/components/roster/RosterTable";
import { TaskCompletionStatusBadge } from "@/components/tasks/TaskCompletionStatusBadge";
import { TaskFormCredenza } from "@/components/tasks/TaskFormCredenza";
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
import { useGroupTeamFilterState } from "@/hooks/groups/useGroupTeamFilterState";
import { useGroupsBoard } from "@/hooks/groups/useGroupsBoard";
import { useCan } from "@/hooks/permissions/useCan";
import { useClassUserSettings } from "@/hooks/roster/useClassUserSettings";
import { useEnsureStudentRosters } from "@/hooks/roster/useEnsureStudentRosters";
import { useRosterConsumerColumnVisibility } from "@/hooks/roster/useRosterConsumerColumnVisibility";
import { useStudentRoster } from "@/hooks/roster/useStudentRoster";
import { useStudentRosterFilter } from "@/hooks/students/useStudentRosterFilter";
import { useRemoveTask } from "@/hooks/tasks/useRemoveTask";
import { useSetTaskCompletion } from "@/hooks/tasks/useSetTaskCompletion";
import { useTask } from "@/hooks/tasks/useTask";
import { useUpdateTask } from "@/hooks/tasks/useUpdateTask";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { formatLocalizedDateTime } from "@/i18n/formatDate";
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
import {
  isClassTaskDetail,
  isPersonalTaskDetail,
  isTaskPastDue,
  type TaskDetailClass,
  type TaskDetailPersonal,
} from "@/lib/tasks/tasks";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const TASKS_ROSTER_SURFACE = "tasks";

type TaskDetailPageProps = {
  classId: Id<"classes">;
  taskId: Id<"tasks">;
};

export function TaskDetailPage({ classId, taskId }: TaskDetailPageProps) {
  const { can, isPending: permissionsPending } = useCan();
  const canComplete = can("tasks:complete");

  if (permissionsPending) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (canComplete) {
    return <StaffTaskDetailPage classId={classId} taskId={taskId} />;
  }
  return <PersonalTaskDetailPage classId={classId} taskId={taskId} />;
}

function TaskDetailBackLink({ classId }: { classId: Id<"classes"> }) {
  const { t } = useTranslation("tasks");
  return (
    <Button
      type="button"
      variant="ghost"
      className="w-fit"
      render={<Link to="/class/$classId/tasks" params={{ classId }} />}
    >
      <ArrowLeft className="size-4" />
      {t("backToList")}
    </Button>
  );
}

function StaffTaskDetailPage({ classId, taskId }: TaskDetailPageProps) {
  const { t } = useTranslation("tasks");
  const { t: tClasses } = useTranslation("classes");
  const navigate = useNavigate();
  const { can } = useCan();
  const canManage = can("tasks:manage");
  const canComplete = can("tasks:complete");
  const canReadStudents = can("students:read");
  const unnamed = tClasses("unnamedMember");

  const { data, isPending, isError, refetch } = useTask(classId, taskId);
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
  const updateTask = useUpdateTask();
  const removeTask = useRemoveTask();
  const setCompletion = useSetTaskCompletion();

  useEnsureStudentRosters(
    classId,
    canReadStudents && !rosterPending && !isAuthLoading && !rosterError,
  );

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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
    TASKS_ROSTER_SURFACE,
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

  const classDetail = data && isClassTaskDetail(data) ? data : null;
  const completedSet = useMemo(
    () => new Set(classDetail?.completedStudentIds ?? []),
    [classDetail?.completedStudentIds],
  );

  const completionColumns = useMemo((): ColumnDef<StudentRosterEntry, unknown>[] => {
    return [
      {
        id: "taskCompleted",
        accessorFn: (student) => completedSet.has(student.userId),
        header: ({ column }) => (
          <div className="flex justify-center">
            <DataTableSortableHeader
              label={t("columnDone")}
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
                aria-label={t("completeAria", { name: displayName })}
                onCheckedChange={(value) => {
                  if (!canComplete) return;
                  const next = value === true;
                  if (next === completed) return;
                  void setCompletion.mutateAsync({
                    classId,
                    taskId,
                    studentUserId: student.userId,
                    completed: next,
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
      },
    ];
  }, [canComplete, classId, completedSet, nameFormat, setCompletion, t, taskId, unnamed]);

  const studentsPending =
    boardPending || (canReadStudents && rosterPending && roster === undefined);

  if (isPending || studentsPending) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || boardError) {
    return (
      <div className="px-4 py-8 sm:px-8">
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedDescription")}
          onRetry={() => {
            void refetch();
            void refetchBoard();
            if (canReadStudents) void refetchRoster();
          }}
        />
      </div>
    );
  }

  if (!classDetail) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <TaskDetailBackLink classId={classId} />
        <ErrorState title={t("notFoundTitle")} description={t("notFoundDescription")} />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-8 sm:px-8">
      <StaffTaskHeader
        classId={classId}
        task={classDetail}
        canManage={canManage}
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
      />

      <GroupTeamFilterButtons classId={classId} />

      {filtered.length === 0 ? (
        <Empty className="border border-dashed">
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
            extraColumns={completionColumns}
          />
        </div>
      )}

      {canManage ? (
        <>
          <TaskFormCredenza
            open={editOpen}
            onOpenChange={setEditOpen}
            mode="edit"
            initial={classDetail}
            onSubmit={async (values) => {
              await updateTask.mutateAsync({
                classId,
                taskId,
                name: values.name,
                description: values.description,
                dueDateKey: values.dueDateKey,
              });
            }}
          />
          <DeleteNamedCredenza
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title={t("deleteConfirmTitle", { name: classDetail.name })}
            description={t("deleteConfirmDescription")}
            confirmLabel={t("deleteAction")}
            onConfirm={async () => {
              await removeTask.mutateAsync({ classId, taskId });
              void navigate({ to: "/class/$classId/tasks", params: { classId } });
            }}
          />
        </>
      ) : null}
    </div>
  );
}

function StaffTaskHeader({
  classId,
  task,
  canManage,
  onEdit,
  onDelete,
}: {
  classId: Id<"classes">;
  task: TaskDetailClass;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("tasks");
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-2">
        <TaskDetailBackLink classId={classId} />
        <h1 className="text-2xl font-semibold tracking-tight">{task.name}</h1>
        {task.description ? (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {task.dueDateKey ? `${t("dueDateValue", { date: task.dueDateKey })} · ` : null}
          {t("statsCompleted", {
            completed: task.completedStudentIds.length,
            total: task.studentCount,
          })}
          {task.updatedAt !== task.createdAt
            ? ` · ${t("updatedAt", { date: formatLocalizedDateTime(task.updatedAt) })}`
            : null}
        </p>
      </div>
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onEdit}>
            <Pencil className="size-4" />
            {t("editAction")}
          </Button>
          <Button type="button" variant="destructive" onClick={onDelete}>
            <Trash2 className="size-4" />
            {t("deleteAction")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function PersonalTaskDetailPage({ classId, taskId }: TaskDetailPageProps) {
  const { t } = useTranslation("tasks");
  const { t: tClasses } = useTranslation("classes");
  const { data, isPending, isError, refetch } = useTask(classId, taskId);

  if (isPending) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-4 py-8 sm:px-8">
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedDescription")}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (!data || !isPersonalTaskDetail(data)) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <TaskDetailBackLink classId={classId} />
        <ErrorState title={t("notFoundTitle")} description={t("notFoundDescription")} />
      </div>
    );
  }

  return (
    <PersonalTaskDetailContent classId={classId} task={data} unnamed={tClasses("unnamedMember")} />
  );
}

function PersonalTaskDetailContent({
  classId,
  task,
  unnamed,
}: {
  classId: Id<"classes">;
  task: TaskDetailPersonal;
  unnamed: string;
}) {
  const { t } = useTranslation("tasks");
  const completedCount = task.students.filter((student) => student.completed).length;
  const total = task.students.length;
  const allDone = total > 0 && completedCount >= total;
  const pastDue = isTaskPastDue(task.dueDateKey);

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex min-w-0 flex-col gap-2">
        <TaskDetailBackLink classId={classId} />
        <h1 className="text-2xl font-semibold tracking-tight">{task.name}</h1>
        {task.description ? (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {task.dueDateKey ? <span>{t("dueDateValue", { date: task.dueDateKey })}</span> : null}
          {total > 0 ? (
            <TaskCompletionStatusBadge
              completed={allDone}
              pastDue={pastDue}
              label={
                total <= 1 ? undefined : t("statsCompleted", { completed: completedCount, total })
              }
            />
          ) : null}
          {task.updatedAt !== task.createdAt ? (
            <span>{t("updatedAt", { date: formatLocalizedDateTime(task.updatedAt) })}</span>
          ) : null}
        </div>
      </div>

      {task.students.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListTodo />
            </EmptyMedia>
            <EmptyTitle>{t("personalStudentsEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("personalStudentsEmptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="divide-y rounded-xl border">
          {task.students.map((student) => {
            const displayName = getRosterDisplayName(student, unnamed);
            return (
              <li
                key={student.userId}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <span className="min-w-0 truncate font-medium">{displayName}</span>
                <TaskCompletionStatusBadge completed={student.completed} pastDue={pastDue} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
