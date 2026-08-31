import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArchiveIcon, ArchiveRestoreIcon, ListTodo, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { DeleteNamedCredenza } from "@/components/groups/DeleteNamedCredenza";
import { GroupTeamFilterButtons } from "@/components/groups/GroupTeamFilterButtons";
import { StudentGridSortMenu } from "@/components/students/StudentGridSortMenu";
import { TaskCompletionGroupStats } from "@/components/tasks/TaskCompletionGroupStats";
import { TaskCompletionStatusBadge } from "@/components/tasks/TaskCompletionStatusBadge";
import { TaskFormCredenza } from "@/components/tasks/TaskFormCredenza";
import { WorksheetImagePreview } from "@/components/upload/WorksheetImagePreview";
import {
  TASK_STUDENT_GRID_CLASS,
  TaskStudentCompletionCard,
} from "@/components/tasks/TaskStudentCompletionCard";
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
import { useGroupTeamFilterState } from "@/hooks/groups/useGroupTeamFilterState";
import { useGroupsBoard } from "@/hooks/groups/useGroupsBoard";
import { useCan } from "@/hooks/permissions/useCan";
import { useEnsureStudentRosters } from "@/hooks/roster/useEnsureStudentRosters";
import { useStudentRoster } from "@/hooks/roster/useStudentRoster";
import { useStudentRosterFilter } from "@/hooks/students/useStudentRosterFilter";
import { useRemoveTask } from "@/hooks/tasks/useRemoveTask";
import { useSetTaskArchived } from "@/hooks/tasks/useSetTaskArchived";
import { useSetTaskCompletion } from "@/hooks/tasks/useSetTaskCompletion";
import { useTask } from "@/hooks/tasks/useTask";
import { useUpdateTask } from "@/hooks/tasks/useUpdateTask";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { formatLocalizedDateTime, formatLocalizedDueDate } from "@/i18n/formatDate";
import { buildMembershipIndex } from "@/lib/groups/groupTeamFilters";
import { collectAllStudents, sortStudents } from "@/lib/groups/groups";
import {
  compactRosterDisplayNames,
  getRosterDisplayName,
  resolveRosterNameFormat,
  type StudentRosterEntry,
} from "@/lib/roster/roster";
import {
  computeTaskGroupCompletionStats,
  isClassTaskDetail,
  isPersonalTaskDetail,
  isTaskArchived,
  isTaskPastDue,
  nextTaskStudentSortState,
  sortTaskStudents,
  TASK_STUDENT_SORT_KEYS,
  type TaskDetailClass,
  type TaskDetailPersonal,
  type TaskStudentSortKey,
} from "@/lib/tasks/tasks";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { GC_TIME } from "@/lib/queryCache";

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
  const { t: tGroups } = useTranslation("groups");
  const navigate = useNavigate();
  const { can } = useCan();
  const canManage = can("tasks:manage");
  const canComplete = can("tasks:complete");
  const canReadStudents = can("students:read");
  const unnamed = tClasses("unnamedMember");
  const ungroupedLabel = tGroups("groupsUngroupedTitle");

  const { data, isPending, isError, refetch } = useTask(classId, taskId);
  const { data: classDoc } = useAuthedQuery(
    api.classes.get,
    { classId },
    { gcTime: GC_TIME.stable },
  );
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
  const groupTeamFilterState = useGroupTeamFilterState(classId);
  const updateTask = useUpdateTask();
  const removeTask = useRemoveTask();
  const setArchived = useSetTaskArchived();
  const setCompletion = useSetTaskCompletion();

  useEnsureStudentRosters(
    classId,
    canReadStudents && !rosterPending && !isAuthLoading && !rosterError,
  );

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [sortKey, setSortKey] = useState<TaskStudentSortKey>("firstName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const nameFormat = useMemo(
    () =>
      resolveRosterNameFormat({
        rosterNameOrder: classDoc?.rosterNameOrder,
        rosterNameSpace: classDoc?.rosterNameSpace,
      }),
    [classDoc?.rosterNameOrder, classDoc?.rosterNameSpace],
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

  const compactNames = useMemo(
    () => compactRosterDisplayNames(students, unnamed, nameFormat),
    [nameFormat, students, unnamed],
  );

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
  const sorted = useMemo(
    () => sortTaskStudents(filtered, sortKey, sortDirection, completedSet),
    [completedSet, filtered, sortDirection, sortKey],
  );
  const includedStudentIds = useMemo(
    () => new Set(filtered.map((student) => student.userId)),
    [filtered],
  );
  const filteredCompletedCount = useMemo(
    () => filtered.filter((student) => completedSet.has(student.userId)).length,
    [completedSet, filtered],
  );
  const groupStats = useMemo(() => {
    if (!groupsBoard) return [];
    return computeTaskGroupCompletionStats({
      board: groupsBoard,
      completedStudentIds: completedSet,
      includedStudentIds,
      ungroupedLabel,
    });
  }, [completedSet, groupsBoard, includedStudentIds, ungroupedLabel]);

  const studentsPending =
    boardPending || (canReadStudents && rosterPending && roster === undefined);

  const sortLabels: Record<TaskStudentSortKey, string> = {
    firstName: t("sortFirstName"),
    lastName: t("sortLastName"),
    rosterNumber: t("sortRosterNumber"),
    done: t("sortDone"),
  };
  const sortLabelsShort: Record<TaskStudentSortKey, string> = {
    firstName: t("sortFirstNameShort"),
    lastName: t("sortLastNameShort"),
    rosterNumber: t("sortRosterNumberShort"),
    done: t("sortDoneShort"),
  };

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
        onArchiveToggle={() => {
          void setArchived.mutateAsync({
            classId,
            taskId,
            archived: classDetail.archivedAt === undefined,
          });
        }}
      />

      <GroupTeamFilterButtons
        classId={classId}
        trailing={
          <StudentGridSortMenu
            keys={TASK_STUDENT_SORT_KEYS}
            sortKey={sortKey}
            sortDirection={sortDirection}
            labels={sortLabels}
            labelsShort={sortLabelsShort}
            ariaLabel={t("sortMenuAria", {
              label: sortLabels[sortKey],
              direction: sortDirection === "asc" ? t("sortDirectionAsc") : t("sortDirectionDesc"),
            })}
            onSortChange={(key) => {
              const state = nextTaskStudentSortState(sortKey, sortDirection, key);
              setSortKey(state.sortKey);
              setSortDirection(state.sortDirection);
            }}
          />
        }
      />

      <TaskCompletionGroupStats
        className="text-sm text-muted-foreground"
        completedCount={filteredCompletedCount}
        studentCount={filtered.length}
        groupStats={groupStats}
        allDone={filtered.length > 0 && filteredCompletedCount >= filtered.length}
      />

      {filtered.length === 0 ? (
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
        <ul className={TASK_STUDENT_GRID_CLASS}>
          {sorted.map((student) => {
            const completed = completedSet.has(student.userId);
            const compactName = compactNames.get(student.userId) ?? unnamed;
            const displayName = getRosterDisplayName(student, unnamed, nameFormat);
            return (
              <li key={student.userId}>
                <TaskStudentCompletionCard
                  name={compactName}
                  completed={completed}
                  disabled={!canComplete}
                  ariaLabel={t("completeAria", { name: displayName })}
                  onToggle={() => {
                    if (!canComplete) return;
                    void setCompletion.mutateAsync({
                      classId,
                      taskId,
                      studentUserId: student.userId,
                      completed: !completed,
                      ...(classDetail.assignmentId
                        ? { assignmentId: classDetail.assignmentId }
                        : {}),
                    });
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}

      {canManage ? (
        <>
          <TaskFormCredenza
            open={editOpen}
            onOpenChange={setEditOpen}
            classId={classId}
            mode="edit"
            initial={classDetail}
            onSubmit={async (values) => {
              await updateTask.mutateAsync({
                classId,
                taskId,
                name: values.name,
                description: values.description,
                dueDateKey: values.dueDateKey,
                worksheetImageFileId: values.worksheetImageFileId,
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
  onArchiveToggle,
}: {
  classId: Id<"classes">;
  task: TaskDetailClass;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onArchiveToggle: () => void;
}) {
  const { t } = useTranslation("tasks");
  const archived = isTaskArchived(task);
  const allDone = task.studentCount > 0 && task.completedStudentIds.length >= task.studentCount;
  const meta = [
    task.dueDateKey ? t("dueDateValue", { date: formatLocalizedDueDate(task.dueDateKey) }) : null,
    task.updatedAt !== task.createdAt
      ? t("updatedAt", { date: formatLocalizedDateTime(task.updatedAt) })
      : null,
  ].filter((part): part is string => Boolean(part));

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-2">
        <TaskDetailBackLink classId={classId} />
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{task.name}</h1>
        {archived || allDone ? (
          <div className="flex flex-wrap items-center gap-2">
            {archived ? <Badge variant="outline">{t("archivedBadge")}</Badge> : null}
            {allDone ? <TaskCompletionStatusBadge completed label={t("statusAllDone")} /> : null}
          </div>
        ) : null}
        {task.description ? (
          <p className="text-muted-foreground whitespace-pre-wrap">{task.description}</p>
        ) : null}
        {task.worksheetImageFileId ? (
          <WorksheetImagePreview
            fileId={task.worksheetImageFileId}
            alt={t("worksheetImagePreviewAlt")}
            downloadLabel={t("worksheetImageDownload")}
            expandLabel={t("worksheetImageExpand")}
            title={t("worksheetImageLabel")}
            hint={t("worksheetImageEnlargeHint")}
            fileName={task.worksheetImage?.name}
          />
        ) : null}
        {task.assignmentId && task.assignmentName ? (
          <p className="text-sm">
            <Link
              to="/class/$classId/assignments/$assignmentId"
              params={{ classId, assignmentId: task.assignmentId }}
              className="rounded-sm text-muted-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("linkedAssignment", { name: task.assignmentName })}
            </Link>
          </p>
        ) : null}
        {meta.length > 0 ? (
          <p className="text-sm text-muted-foreground">{meta.join(" · ")}</p>
        ) : null}
      </div>
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onEdit}>
            <Pencil className="size-4" />
            {t("editAction")}
          </Button>
          <Button type="button" variant="outline" onClick={onArchiveToggle}>
            {archived ? (
              <ArchiveRestoreIcon className="size-4" />
            ) : (
              <ArchiveIcon className="size-4" />
            )}
            {archived ? t("restoreAction") : t("archiveAction")}
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
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{task.name}</h1>
        {task.description ? (
          <p className="text-muted-foreground whitespace-pre-wrap">{task.description}</p>
        ) : null}
        {task.worksheetImageFileId ? (
          <WorksheetImagePreview
            fileId={task.worksheetImageFileId}
            alt={t("worksheetImagePreviewAlt")}
            expandLabel={t("worksheetImageExpand")}
            title={t("worksheetImageLabel")}
            hint={t("worksheetImageEnlargeHint")}
            fileName={task.worksheetImage?.name}
            canDownload={false}
          />
        ) : null}
        {task.assignmentId && task.assignmentName ? (
          <p className="text-sm">
            <Link
              to="/class/$classId/assignments/$assignmentId"
              params={{ classId, assignmentId: task.assignmentId }}
              className="rounded-sm text-muted-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("linkedAssignment", { name: task.assignmentName })}
            </Link>
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {task.dueDateKey ? (
            <span>{t("dueDateValue", { date: formatLocalizedDueDate(task.dueDateKey) })}</span>
          ) : null}
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
        <Empty card>
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
