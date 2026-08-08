import { Link } from "@tanstack/react-router";
import { ChevronRight, ClipboardList, FolderOpen, ListTodo, Plus } from "lucide-react";
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
import { useCreateTask } from "@/hooks/tasks/useCreateTask";
import { useRemoveTask } from "@/hooks/tasks/useRemoveTask";
import { useTasks } from "@/hooks/tasks/useTasks";
import { useUpdateTask } from "@/hooks/tasks/useUpdateTask";
import { useCan } from "@/hooks/permissions/useCan";
import {
  filterTasksByName,
  formatTaskAssignmentFolderMeta,
  groupTasksByAssignment,
  nextTaskSortState,
  sortTasks,
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
  const { can, isPending: permissionsPending } = useCan();
  const canManage = can("tasks:manage");
  const canComplete = can("tasks:complete");
  const personalView = !permissionsPending && !canComplete;
  const { data, isPending, isError, refetch } = useTasks(classId);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const removeTask = useRemoveTask();

  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<TaskSortKey>("updated");
  const [sortDirection, setSortDirection] = useState<TaskSortDirection>("desc");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TaskListItem | null>(null);
  const [deleting, setDeleting] = useState<TaskListItem | null>(null);
  const [collapsedAssignmentIds, setCollapsedAssignmentIds] = useState(
    () => new Set<Id<"assignments">>(),
  );

  const filteredSorted = useMemo(() => {
    const filtered = filterTasksByName(data ?? [], searchQuery);
    return sortTasks(filtered, sortKey, sortDirection);
  }, [data, searchQuery, sortDirection, sortKey]);

  const { groups, ungrouped } = useMemo(
    () => groupTasksByAssignment(filteredSorted),
    [filteredSorted],
  );

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <TasksToolbar
        sortKey={sortKey}
        sortDirection={sortDirection}
        searchQuery={searchQuery}
        resultCount={filteredSorted.length}
        canCreate={canManage}
        onSearchChange={setSearchQuery}
        onSortChange={(key) => {
          const next = nextTaskSortState(sortKey, sortDirection, key);
          setSortKey(next.sortKey);
          setSortDirection(next.sortDirection);
        }}
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

      {!isPending && !isError && data && data.length === 0 ? (
        <Empty className="border border-dashed">
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

      {!isPending && !isError && data && data.length > 0 && filteredSorted.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListTodo />
            </EmptyMedia>
            <EmptyTitle>{t("searchEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("searchEmptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {!isPending && !isError && filteredSorted.length > 0 ? (
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
                  setCollapsedAssignmentIds((prev) => {
                    const next = new Set(prev);
                    if (nextOpen) next.delete(assignmentId);
                    else next.add(assignmentId);
                    return next;
                  });
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
                    <FolderOpen className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {group.assignmentName}
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
                          onEdit={setEditing}
                          onDelete={setDeleting}
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
                      onEdit={setEditing}
                      onDelete={setDeleting}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {canManage ? (
        <>
          <TaskFormCredenza
            open={createOpen}
            onOpenChange={setCreateOpen}
            mode="create"
            onSubmit={async (values) => {
              await createTask.mutateAsync({
                classId,
                name: values.name,
                description: values.description,
                dueDateKey: values.dueDateKey,
              });
            }}
          />
          <TaskFormCredenza
            open={editing !== null}
            onOpenChange={(open) => {
              if (!open) setEditing(null);
            }}
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
