import { ListTodo, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { DeleteNamedCredenza } from "@/components/groups/DeleteNamedCredenza";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskFormCredenza } from "@/components/tasks/TaskFormCredenza";
import { TasksToolbar } from "@/components/tasks/TasksToolbar";
import { Button } from "@/components/ui/button";
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
  nextTaskSortState,
  sortTasks,
  type TaskListItem,
  type TaskSortDirection,
  type TaskSortKey,
} from "@/lib/tasks/tasks";
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

  const filteredSorted = useMemo(() => {
    const filtered = filterTasksByName(data ?? [], searchQuery);
    return sortTasks(filtered, sortKey, sortDirection);
  }, [data, searchQuery, sortDirection, sortKey]);

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
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSorted.map((task) => (
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
