import { type DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Link } from "@tanstack/react-router";
import { ChevronRight, ClipboardList, ListTodo, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { DeleteNamedCredenza } from "@/components/groups/DeleteNamedCredenza";
import { SortableFormItem, SortableVerticalList } from "@/components/form/SortableFormList";
import { TaskAllDoneOverview } from "@/components/tasks/TaskAllDoneOverview";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskFormCredenza } from "@/components/tasks/TaskFormCredenza";
import { TaskListRow } from "@/components/tasks/TaskListRow";
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
import { useStudentRoster } from "@/hooks/roster/useStudentRoster";
import { useCreateTask } from "@/hooks/tasks/useCreateTask";
import { useRemoveTask } from "@/hooks/tasks/useRemoveTask";
import { useReorderTasks } from "@/hooks/tasks/useReorderTasks";
import { useSetTaskArchived } from "@/hooks/tasks/useSetTaskArchived";
import { useTasks } from "@/hooks/tasks/useTasks";
import { useUpdateTask } from "@/hooks/tasks/useUpdateTask";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { GC_TIME } from "@/lib/queryCache";
import { resolveRosterNameFormat } from "@/lib/roster/roster";
import {
  buildTaskTopLevelItems,
  computeTaskGroupCompletionStats,
  filterTasksByName,
  formatTaskAssignmentFolderMeta,
  partitionTasksByArchive,
  toTaskReorderItems,
  type TaskAssignmentGroup,
  type TaskGroupCompletionStat,
  type TaskListItem,
  type TaskTopLevelItem,
} from "@/lib/tasks/tasks";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";
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
  const { data: roster } = useStudentRoster(classId);
  const { data: classDoc } = useAuthedQuery(
    api.classes.get,
    { classId },
    { gcTime: GC_TIME.stable },
  );
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const removeTask = useRemoveTask();
  const setArchived = useSetTaskArchived();
  const reorderTasks = useReorderTasks();

  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TaskListItem | null>(null);
  const [deleting, setDeleting] = useState<TaskListItem | null>(null);
  const [collapsedAssignmentIds, setCollapsedAssignmentIds] = useState(
    () => new Set<Id<"assignments">>(),
  );

  const { active, archived } = useMemo(() => {
    const filtered = filterTasksByName(data ?? [], searchQuery);
    return partitionTasksByArchive(filtered);
  }, [data, searchQuery]);

  const activeItems = useMemo(() => buildTaskTopLevelItems(active), [active]);
  const archivedItems = useMemo(() => buildTaskTopLevelItems(archived), [archived]);

  const resultCount = showArchived ? active.length + archived.length : active.length;
  const hasCatalog = (data?.length ?? 0) > 0;
  const hasActiveSearch = searchQuery.trim().length > 0;
  const hasVisibleTasks = active.length > 0 || (showArchived && archived.length > 0);
  const canReorder = canManage && !hasActiveSearch && !showArchived;

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

  const nameFormat = useMemo(
    () =>
      resolveRosterNameFormat({
        rosterNameOrder: classDoc?.rosterNameOrder,
        rosterNameSpace: classDoc?.rosterNameSpace,
      }),
    [classDoc?.rosterNameOrder, classDoc?.rosterNameSpace],
  );

  const handleArchiveToggle = (task: TaskListItem) => {
    void setArchived.mutateAsync({
      classId,
      taskId: task._id,
      archived: task.archivedAt === undefined,
    });
  };

  const handleReorder = (event: DragEndEvent) => {
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id) return;
    const oldIndex = activeItems.findIndex((item) => item.id === dragged.id);
    const newIndex = activeItems.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const nextItems = arrayMove(activeItems, oldIndex, newIndex);
    void reorderTasks.mutateAsync({
      classId,
      items: toTaskReorderItems(nextItems),
    });
  };

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <TasksToolbar
        searchQuery={searchQuery}
        resultCount={resultCount}
        canCreate={canManage}
        showArchived={showArchived}
        personalView={personalView}
        onSearchChange={setSearchQuery}
        onToggleArchived={canManage ? () => setShowArchived((value) => !value) : undefined}
        onCreate={() => setCreateOpen(true)}
      />

      {!personalView && roster && (data?.length ?? 0) > 0 ? (
        <TaskAllDoneOverview tasks={data ?? []} roster={roster} nameFormat={nameFormat} />
      ) : null}

      {isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
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
            <TaskTopLevelList
              classId={classId}
              items={archivedItems}
              personalView={personalView}
              canReorder={false}
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
        <TaskTopLevelList
          classId={classId}
          items={activeItems}
          personalView={personalView}
          canReorder={canReorder}
          groupStatsByTaskId={groupStatsByTaskId}
          collapsedAssignmentIds={collapsedAssignmentIds}
          onCollapsedChange={setCollapsedAssignmentIds}
          onEdit={setEditing}
          onDelete={setDeleting}
          onArchiveToggle={handleArchiveToggle}
          onReorder={canReorder ? handleReorder : undefined}
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
                ...values,
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
                ...values,
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

type TaskTopLevelListProps = {
  classId: Id<"classes">;
  items: TaskTopLevelItem[];
  personalView: boolean;
  canReorder: boolean;
  groupStatsByTaskId: Map<Id<"tasks">, TaskGroupCompletionStat[]>;
  collapsedAssignmentIds: Set<Id<"assignments">>;
  onCollapsedChange: (next: Set<Id<"assignments">>) => void;
  onEdit: (task: TaskListItem) => void;
  onDelete: (task: TaskListItem) => void;
  onArchiveToggle: (task: TaskListItem) => void;
  onReorder?: (event: DragEndEvent) => void;
};

function TaskTopLevelList({
  classId,
  items,
  personalView,
  canReorder,
  groupStatsByTaskId,
  collapsedAssignmentIds,
  onCollapsedChange,
  onEdit,
  onDelete,
  onArchiveToggle,
  onReorder,
}: TaskTopLevelListProps) {
  const { t } = useTranslation("tasks");
  const itemIds = items.map((item) => item.id);
  const list = (
    <div className="flex flex-col gap-3">
      {items.map((item) => {
        const dragLabel =
          item.type === "assignment"
            ? t("reorderHandleAria", { name: item.group.assignmentName })
            : t("reorderHandleAria", { name: item.task.name });
        const body =
          item.type === "assignment" ? (
            <AssignmentFolder
              classId={classId}
              group={item.group}
              personalView={personalView}
              groupStatsByTaskId={groupStatsByTaskId}
              collapsedAssignmentIds={collapsedAssignmentIds}
              onCollapsedChange={onCollapsedChange}
              onEdit={onEdit}
              onDelete={onDelete}
              onArchiveToggle={onArchiveToggle}
            />
          ) : personalView ? (
            <div className="overflow-hidden rounded-xl border border-border">
              <TaskListRow classId={classId} task={item.task} />
            </div>
          ) : (
            <TaskCard
              classId={classId}
              task={item.task}
              personalView={personalView}
              groupStats={groupStatsByTaskId.get(item.task._id)}
              onEdit={onEdit}
              onDelete={onDelete}
              onArchiveToggle={onArchiveToggle}
            />
          );

        if (!canReorder || !onReorder) {
          return <div key={item.id}>{body}</div>;
        }

        return (
          <SortableFormItem key={item.id} id={item.id} dragLabel={dragLabel}>
            {(dragHandle) => (
              <div className="flex items-start gap-2">
                <div className="pt-3">{dragHandle}</div>
                <div className="min-w-0 flex-1">{body}</div>
              </div>
            )}
          </SortableFormItem>
        );
      })}
    </div>
  );

  if (!canReorder || !onReorder) {
    return list;
  }

  return (
    <SortableVerticalList itemIds={itemIds} onReorder={onReorder}>
      {list}
    </SortableVerticalList>
  );
}

type AssignmentFolderProps = {
  classId: Id<"classes">;
  group: TaskAssignmentGroup;
  personalView: boolean;
  groupStatsByTaskId: Map<Id<"tasks">, TaskGroupCompletionStat[]>;
  collapsedAssignmentIds: Set<Id<"assignments">>;
  onCollapsedChange: (next: Set<Id<"assignments">>) => void;
  onEdit: (task: TaskListItem) => void;
  onDelete: (task: TaskListItem) => void;
  onArchiveToggle: (task: TaskListItem) => void;
};

function AssignmentFolder({
  classId,
  group,
  personalView,
  groupStatsByTaskId,
  collapsedAssignmentIds,
  onCollapsedChange,
  onEdit,
  onDelete,
  onArchiveToggle,
}: AssignmentFolderProps) {
  const { t } = useTranslation("tasks");
  const assignmentId = group.assignmentId;
  const open = !collapsedAssignmentIds.has(assignmentId);
  const folderMeta = formatTaskAssignmentFolderMeta(group);

  return (
    <Collapsible
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
              <span className="block truncate text-xs text-muted-foreground">{folderMeta}</span>
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
        {personalView ? (
          <ul className="divide-y overflow-hidden rounded-xl border">
            {group.tasks.map((task) => (
              <li key={task._id}>
                <TaskListRow classId={classId} task={task} showProcedureStepNumber />
              </li>
            ))}
          </ul>
        ) : (
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
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
