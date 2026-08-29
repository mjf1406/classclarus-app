import { Link } from "@tanstack/react-router";
import { ChevronRight, ClipboardList, ListTodo, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { DeleteNamedCredenza } from "@/components/groups/DeleteNamedCredenza";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskFormCredenza } from "@/components/tasks/TaskFormCredenza";
import { TasksToolbar } from "@/components/tasks/TasksToolbar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useGroupsBoard } from "@/hooks/groups/useGroupsBoard";
import { useCan } from "@/hooks/permissions/useCan";
import { useCreateTask } from "@/hooks/tasks/useCreateTask";
import { useRemoveTask } from "@/hooks/tasks/useRemoveTask";
import { useSetTaskArchived } from "@/hooks/tasks/useSetTaskArchived";
import { useTasks } from "@/hooks/tasks/useTasks";
import { useUpdateTask } from "@/hooks/tasks/useUpdateTask";
import {
  computeTaskGroupCompletionStats,
  filterTasksByName,
  formatTaskAssignmentFolderMeta,
  groupTasksByAssignment,
  nextTaskSortState,
  partitionTasksByArchive,
  sortTasks,
  type TaskAssignmentGroup,
  type TaskGroupCompletionStat,
  type TaskListItem,
  type TaskSortDirection,
  type TaskSortKey,
} from "@/lib/tasks/tasks";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

type TasksPageProps = {
  classId: Id<"classes">;
};

export function TasksPage({ classId }: TasksPageProps) {
  const { t } = useTranslation("tasks");
  const { t: tGroups } = useTranslation("groups");
  const { can, isPending: permissionsPending } = useCan();
  const canManage = can("tasks:manage");
  const canComplete = can("tasks:complete");
  const personalView = !permissionsPending && !canComplete;
  const { data, isPending, isError, refetch } = useTasks(classId);
  const { data: groupsBoard } = useGroupsBoard(classId);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const removeTask = useRemoveTask();
  const setArchived = useSetTaskArchived();

  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<TaskSortKey>("updated");
  const [sortDirection, setSortDirection] = useState<TaskSortDirection>("desc");
  const [showArchived, setShowArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TaskListItem | null>(null);
  const [deleting, setDeleting] = useState<TaskListItem | null>(null);
  const [collapsedAssignmentIds, setCollapsedAssignmentIds] = useState(
    () => new Set<Id<"assignments">>(),
  );

  const { active, archived } = useMemo(() => {
    const filtered = filterTasksByName(data ?? [], searchQuery);
    const partitioned = partitionTasksByArchive(filtered);
    return {
      active: sortTasks(partitioned.active, sortKey, sortDirection),
      archived: sortTasks(partitioned.archived, sortKey, sortDirection),
    };
  }, [data, searchQuery, sortDirection, sortKey]);

  const activeGrouped = useMemo(() => groupTasksByAssignment(active), [active]);
  const archivedGrouped = useMemo(() => groupTasksByAssignment(archived), [archived]);

  const resultCount = showArchived ? active.length + archived.length : active.length;
  const hasCatalog = (data?.length ?? 0) > 0;
  const hasActiveSearch = searchQuery.trim().length > 0;
  const hasVisibleTasks = active.length > 0 || (showArchived && archived.length > 0);

  const groupStatsByTaskId = useMemo(() => {
    const empty = new Map<Id<"tasks">, TaskGroupCompletionStat[]>();
    if (personalView || !groupsBoard) {
      return empty;
    }
    const ungroupedLabel = tGroups("groupsUngroupedTitle");
    return new Map(
      (data ?? []).map((task) => [
        task._id,
        computeTaskGroupCompletionStats({
          board: groupsBoard,
          completedStudentIds: new Set(task.completedStudentIds ?? []),
          ungroupedLabel,
        }),
      ]),
    );
  }, [data, groupsBoard, personalView, tGroups]);

  const handleArchiveToggle = (task: TaskListItem) => {
    void setArchived.mutateAsync({
      classId,
      taskId: task._id,
      archived: task.archivedAt === undefined,
    });
  };

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <TasksToolbar
        sortKey={sortKey}
        sortDirection={sortDirection}
        searchQuery={searchQuery}
        resultCount={resultCount}
        canCreate={canManage}
        showArchived={showArchived}
        onSearchChange={setSearchQuery}
        onSortChange={(key) => {
          const next = nextTaskSortState(sortKey, sortDirection, key);
          setSortKey(next.sortKey);
          setSortDirection(next.sortDirection);
        }}
        onToggleArchived={canManage ? () => setShowArchived((value) => !value) : undefined}
        onCreate={() => setCreateOpen(true)}
      />

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : null}

      {isError ? (
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedDescription")}
          onRetry={() => void refetch()}
        />
      ) : null}

      {!isPending && !isError && !hasCatalog ? (
        <Empty card>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListTodo />
            </EmptyMedia>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>
              {personalView ? t("emptyDescriptionPersonal") : t("emptyDescription")}
            </EmptyDescription>
          </EmptyHeader>
          {canManage ? (
            <EmptyContent>
              <Button type="button" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                {t("createAction")}
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : null}

      {!isPending && !isError && hasCatalog && hasActiveSearch && !hasVisibleTasks ? (
        <Empty card>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListTodo />
            </EmptyMedia>
            <EmptyTitle>{t("searchEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("searchEmptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {showArchived && hasCatalog ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">{t("archivedSection")}</h2>
          {archived.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("archivedEmpty")}</p>
          ) : (
            <TaskGroupedList
              classId={classId}
              groups={archivedGrouped.groups}
              ungrouped={archivedGrouped.ungrouped}
              personalView={personalView}
              groupStatsByTaskId={groupStatsByTaskId}
              collapsedAssignmentIds={collapsedAssignmentIds}
              onCollapsedChange={setCollapsedAssignmentIds}
              onEdit={setEditing}
              onDelete={setDeleting}
              onArchiveToggle={handleArchiveToggle}
            />
          )}
        </div>
      ) : null}

      {!isPending && !isError && active.length > 0 ? (
        <TaskGroupedList
          classId={classId}
          groups={activeGrouped.groups}
          ungrouped={activeGrouped.ungrouped}
          personalView={personalView}
          groupStatsByTaskId={groupStatsByTaskId}
          collapsedAssignmentIds={collapsedAssignmentIds}
          onCollapsedChange={setCollapsedAssignmentIds}
          onEdit={setEditing}
          onDelete={setDeleting}
          onArchiveToggle={handleArchiveToggle}
        />
      ) : null}

      {canManage ? (
        <>
          <TaskFormCredenza
            open={createOpen}
            onOpenChange={setCreateOpen}
            classId={classId}
            mode="create"
            onSubmit={async (values) => {
              await createTask.mutateAsync({
                classId,
                name: values.name,
                description: values.description,
                dueDateKey: values.dueDateKey,
                worksheetImageFileId: values.worksheetImageFileId,
              });
            }}
          />
          <TaskFormCredenza
            open={editing !== null}
            onOpenChange={(open) => {
              if (!open) setEditing(null);
            }}
            classId={classId}
            mode="edit"
            initial={editing}
            onSubmit={async (values) => {
              if (!editing) return;
              await updateTask.mutateAsync({
                classId,
                taskId: editing._id,
                name: values.name,
                description: values.description,
                dueDateKey: values.dueDateKey,
                worksheetImageFileId: values.worksheetImageFileId,
              });
              setEditing(null);
            }}
          />
          <DeleteNamedCredenza
            open={deleting !== null}
            onOpenChange={(open) => {
              if (!open) setDeleting(null);
            }}
            title={t("deleteConfirmTitle", { name: deleting?.name ?? "" })}
            description={t("deleteConfirmDescription")}
            confirmLabel={t("deleteAction")}
            onConfirm={async () => {
              if (!deleting) return;
              await removeTask.mutateAsync({
                classId,
                taskId: deleting._id,
              });
              setDeleting(null);
            }}
          />
        </>
      ) : null}
    </div>
  );
}

type TaskGroupedListProps = {
  classId: Id<"classes">;
  groups: TaskAssignmentGroup[];
  ungrouped: TaskListItem[];
  personalView: boolean;
  groupStatsByTaskId: Map<Id<"tasks">, TaskGroupCompletionStat[]>;
  collapsedAssignmentIds: Set<Id<"assignments">>;
  onCollapsedChange: (next: Set<Id<"assignments">>) => void;
  onEdit: (task: TaskListItem) => void;
  onDelete: (task: TaskListItem) => void;
  onArchiveToggle: (task: TaskListItem) => void;
};

function TaskGroupedList({
  classId,
  groups,
  ungrouped,
  personalView,
  groupStatsByTaskId,
  collapsedAssignmentIds,
  onCollapsedChange,
  onEdit,
  onDelete,
  onArchiveToggle,
}: TaskGroupedListProps) {
  const { t } = useTranslation("tasks");

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => {
        const assignmentId = group.assignmentId;
        const open = !collapsedAssignmentIds.has(assignmentId);
        const folderMeta = formatTaskAssignmentFolderMeta(group);
        return (
          <Collapsible
            key={assignmentId}
            open={open}
            onOpenChange={(nextOpen) => {
              onCollapsedChange(
                (() => {
                  const next = new Set(collapsedAssignmentIds);
                  if (nextOpen) next.delete(assignmentId);
                  else next.add(assignmentId);
                  return next;
                })(),
              );
            }}
            className="rounded-2xl border border-border"
          >
            <div className="flex items-center gap-1 px-2 py-1.5">
              <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-muted/60">
                <ChevronRight
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    open && "rotate-90",
                  )}
                  aria-hidden
                />
                <ClipboardList className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {t("linkedAssignment", { name: group.assignmentName })}
                  </span>
                  {folderMeta ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {folderMeta}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {t("assignmentGroupCount", { count: group.tasks.length })}
                </span>
              </CollapsibleTrigger>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                aria-label={t("linkedAssignment", { name: group.assignmentName })}
                render={
                  <Link
                    to="/class/$classId/assignments/$assignmentId"
                    params={{ classId, assignmentId }}
                  />
                }
              >
                <ClipboardList className="size-4" />
              </Button>
            </div>
            <CollapsibleContent className="border-t border-border px-3 py-3">
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.tasks.map((task) => (
                  <li key={task._id}>
                    <TaskCard
                      classId={classId}
                      task={task}
                      personalView={personalView}
                      hideAssignmentLink
                      showProcedureStepNumber
                      groupStats={groupStatsByTaskId.get(task._id)}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onArchiveToggle={onArchiveToggle}
                    />
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        );
      })}

      {ungrouped.length > 0 ? (
        <div className="flex flex-col gap-3">
          {groups.length > 0 ? (
            <h2 className="text-sm font-medium text-muted-foreground">{t("ungroupedTasks")}</h2>
          ) : null}
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ungrouped.map((task) => (
              <li key={task._id}>
                <TaskCard
                  classId={classId}
                  task={task}
                  personalView={personalView}
                  groupStats={groupStatsByTaskId.get(task._id)}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onArchiveToggle={onArchiveToggle}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
