import { ChevronRightIcon, ClipboardList } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatLocalizedDueDate } from "@/i18n/formatDate";
import {
  areAllStudentsCompleteOnTask,
  countTaskCompletionsForStudents,
  groupTasksByAssignment,
  isTaskArchived,
  isTaskPastDue,
  partitionActiveTasksByStudentCompletion,
  partitionAssignmentGroupsByCompletion,
  type TaskAssignmentGroup,
  type TaskListItem,
} from "@/lib/tasks/tasks";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

const SCROLL_CLASS = "min-h-0 h-full flex-1 overflow-y-auto rounded-xl border p-2";

type PointsApplyTasksPanelProps = {
  tasks: readonly TaskListItem[];
  studentUserIds: readonly Id<"users">[];
  canComplete: boolean;
  onToggle: (task: TaskListItem, completed: boolean) => void;
};

export function PointsApplyTasksPanel({
  tasks,
  studentUserIds,
  canComplete,
  onToggle,
}: PointsApplyTasksPanelProps) {
  const { t } = useTranslation("points");
  const { t: tTasks } = useTranslation("tasks");
  const [completedOpen, setCompletedOpen] = useState(false);
  const [collapsedAssignmentIds, setCollapsedAssignmentIds] = useState<Set<string>>(
    () => new Set(),
  );

  const active = useMemo(() => tasks.filter((task) => !isTaskArchived(task)), [tasks]);
  const { groups, ungrouped } = useMemo(() => groupTasksByAssignment(active), [active]);
  const { incompleteGroups, completedGroups } = useMemo(
    () => partitionAssignmentGroupsByCompletion(groups, studentUserIds),
    [groups, studentUserIds],
  );
  const { incomplete: ungroupedIncomplete, completed: ungroupedCompleted } = useMemo(
    () => partitionActiveTasksByStudentCompletion(ungrouped, studentUserIds),
    [studentUserIds, ungrouped],
  );
  const completedTaskCount = useMemo(
    () =>
      completedGroups.reduce((sum, group) => sum + group.tasks.length, 0) +
      ungroupedCompleted.length,
    [completedGroups, ungroupedCompleted],
  );

  const toggleAssignmentOpen = (assignmentId: string, nextOpen: boolean) => {
    setCollapsedAssignmentIds((prev) => {
      const next = new Set(prev);
      if (nextOpen) next.delete(assignmentId);
      else next.add(assignmentId);
      return next;
    });
  };

  if (
    incompleteGroups.length === 0 &&
    ungroupedIncomplete.length === 0 &&
    completedTaskCount === 0
  ) {
    return (
      <div className={SCROLL_CLASS}>
        <p className="p-3 text-sm text-muted-foreground">{t("tasksEmpty")}</p>
      </div>
    );
  }

  return (
    <div className={SCROLL_CLASS}>
      <div className="space-y-2">
        {incompleteGroups.map((group) => (
          <AssignmentApplyGroup
            key={group.assignmentId}
            group={group}
            open={!collapsedAssignmentIds.has(group.assignmentId)}
            studentUserIds={studentUserIds}
            canComplete={canComplete}
            onOpenChange={(nextOpen) => toggleAssignmentOpen(group.assignmentId, nextOpen)}
            onToggle={onToggle}
          />
        ))}

        {ungroupedIncomplete.length > 0 ? (
          <div className="space-y-1">
            {incompleteGroups.length > 0 ? (
              <p className="px-2 pt-1 text-xs font-medium text-muted-foreground">
                {tTasks("ungroupedTasks")}
              </p>
            ) : null}
            <TaskApplyList
              tasks={ungroupedIncomplete}
              studentUserIds={studentUserIds}
              canComplete={canComplete}
              onToggle={onToggle}
            />
          </div>
        ) : null}

        {completedTaskCount > 0 ? (
          <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
            <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium hover:bg-muted/60">
              <ChevronRightIcon
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  completedOpen && "rotate-90",
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{t("tasksCompletedSection")}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {t("folderItemCount", { count: completedTaskCount })}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-1 pl-2">
              {completedGroups.map((group) => (
                <AssignmentApplyGroup
                  key={group.assignmentId}
                  group={group}
                  open={!collapsedAssignmentIds.has(group.assignmentId)}
                  studentUserIds={studentUserIds}
                  canComplete={canComplete}
                  onOpenChange={(nextOpen) => toggleAssignmentOpen(group.assignmentId, nextOpen)}
                  onToggle={onToggle}
                />
              ))}
              {ungroupedCompleted.length > 0 ? (
                <TaskApplyList
                  tasks={ungroupedCompleted}
                  studentUserIds={studentUserIds}
                  canComplete={canComplete}
                  onToggle={onToggle}
                />
              ) : null}
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </div>
    </div>
  );
}

function AssignmentApplyGroup({
  group,
  open,
  studentUserIds,
  canComplete,
  onOpenChange,
  onToggle,
}: {
  group: TaskAssignmentGroup;
  open: boolean;
  studentUserIds: readonly Id<"users">[];
  canComplete: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: (task: TaskListItem, completed: boolean) => void;
}) {
  const { t: tTasks } = useTranslation("tasks");

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium hover:bg-muted/60">
        <ChevronRightIcon
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90",
          )}
          aria-hidden
        />
        <ClipboardList className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{group.assignmentName}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {tTasks("assignmentGroupCount", { count: group.tasks.length })}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1 pl-2">
        <TaskApplyList
          tasks={group.tasks}
          studentUserIds={studentUserIds}
          canComplete={canComplete}
          onToggle={onToggle}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

function TaskApplyList({
  tasks,
  studentUserIds,
  canComplete,
  onToggle,
}: {
  tasks: readonly TaskListItem[];
  studentUserIds: readonly Id<"users">[];
  canComplete: boolean;
  onToggle: (task: TaskListItem, completed: boolean) => void;
}) {
  return (
    <ul className="space-y-1">
      {tasks.map((task) => (
        <li key={task._id}>
          <TaskApplyRow
            task={task}
            studentUserIds={studentUserIds}
            canComplete={canComplete}
            onToggle={onToggle}
          />
        </li>
      ))}
    </ul>
  );
}

function TaskApplyRow({
  task,
  studentUserIds,
  canComplete,
  onToggle,
}: {
  task: TaskListItem;
  studentUserIds: readonly Id<"users">[];
  canComplete: boolean;
  onToggle: (task: TaskListItem, completed: boolean) => void;
}) {
  const { t: tTasks } = useTranslation("tasks");
  const allComplete = areAllStudentsCompleteOnTask(task, studentUserIds);
  const completedCount = countTaskCompletionsForStudents(task, studentUserIds);
  const mixed = completedCount > 0 && !allComplete;
  const pastDue = isTaskPastDue(task.dueDateKey);
  const title =
    task.procedureStepNumber !== undefined
      ? tTasks("procedureStepTaskName", { number: task.procedureStepNumber, name: task.name })
      : task.name;

  return (
    <label
      className={cn(
        "flex items-center gap-3 rounded-lg px-2 py-2",
        canComplete ? "cursor-pointer hover:bg-muted/60" : "cursor-default",
      )}
    >
      <Checkbox
        checked={allComplete}
        indeterminate={mixed}
        disabled={!canComplete}
        aria-label={tTasks("completeAria", { name: title })}
        onCheckedChange={(value) => {
          if (!canComplete) return;
          const next = value === true;
          if (next === allComplete) return;
          onToggle(task, next);
        }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {task.dueDateKey ? (
          <span
            className={cn(
              "block truncate text-xs",
              pastDue && !allComplete
                ? "text-amber-700 dark:text-amber-400"
                : "text-muted-foreground",
            )}
          >
            {tTasks("dueDateValue", { date: formatLocalizedDueDate(task.dueDateKey) })}
          </span>
        ) : null}
      </span>
      {studentUserIds.length > 1 ? (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {tTasks("statsCompleted", {
            completed: completedCount,
            total: studentUserIds.length,
          })}
        </span>
      ) : null}
    </label>
  );
}
