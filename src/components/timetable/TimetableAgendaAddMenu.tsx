import { ChevronDown, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast-manager";
import { usePendingRowFocus } from "@/hooks/usePendingRowFocus";
import { randomClientId } from "@/lib/optimistic";
import { groupTasksByAssignment, type TaskListItem } from "@/lib/tasks/tasks";
import {
  appendAgendaItems,
  createAssignmentAgendaItem,
  createTaskAgendaItem,
  createTextAgendaItem,
  excludeExistingTaskIds,
  selectTasksForAssignment,
  type AgendaAssignmentSource,
  type AgendaTaskSource,
  type AppendAgendaItemsResult,
} from "@/lib/timetable/agendaItems";
import type { AgendaItemFormValues } from "@/lib/timetable/timetable";

type TimetableAgendaAddMenuProps = {
  items: Array<AgendaItemFormValues>;
  onChange: (items: Array<AgendaItemFormValues>) => void;
  assignments: ReadonlyArray<AgendaAssignmentSource>;
  tasks: ReadonlyArray<TaskListItem>;
};

export function TimetableAgendaAddMenu({
  items,
  onChange,
  assignments,
  tasks,
}: TimetableAgendaAddMenuProps) {
  const { t } = useTranslation("timetable");
  const { queueRowFocus } = usePendingRowFocus();
  const { groups, ungrouped } = groupTasksByAssignment(tasks);
  const assignmentIdsWithTasks = new Set(
    tasks.flatMap((task) => (task.assignmentId ? [String(task.assignmentId)] : [])),
  );
  const assignmentsWithTasks = assignments.filter((assignment) =>
    assignmentIdsWithTasks.has(assignment._id),
  );

  const applyResult = (result: AppendAgendaItemsResult, focusKey?: string) => {
    if (result.added > 0) {
      onChange(result.items);
      if (focusKey) queueRowFocus(focusKey);
    }
    if (result.skippedLimit > 0 && result.added === 0) {
      toast.add({ type: "warning", title: t("agendaAddNoneFit") });
      return;
    }
    if (result.skippedLimit > 0) {
      toast.add({
        type: "warning",
        title: t("agendaAddSkippedLimit", { count: result.skippedLimit }),
      });
      return;
    }
    if (result.skippedDuplicates > 0) {
      toast.add({
        type: "warning",
        title: t("agendaAddSkippedDuplicates", { count: result.skippedDuplicates }),
      });
    }
  };

  const addTextItem = () => {
    const key = randomClientId();
    applyResult(appendAgendaItems(items, [createTextAgendaItem(key)]), key);
  };

  const addAssignment = (assignment: AgendaAssignmentSource) => {
    const key = randomClientId();
    applyResult(appendAgendaItems(items, [createAssignmentAgendaItem(key, assignment)]), key);
  };

  const addTask = (task: AgendaTaskSource) => {
    const key = randomClientId();
    applyResult(appendAgendaItems(items, [createTaskAgendaItem(key, task)]), key);
  };

  const addAssignmentTasks = (assignmentId: string) => {
    const selected = selectTasksForAssignment(tasks, assignmentId);
    if (selected.length === 0) {
      toast.add({ type: "warning", title: t("addAgendaNoAssignmentTasks") });
      return;
    }
    const incoming = excludeExistingTaskIds(selected, items).map((task) =>
      createTaskAgendaItem(randomClientId(), task),
    );
    if (incoming.length === 0) {
      toast.add({
        type: "warning",
        title: t("agendaAddSkippedDuplicates", { count: selected.length }),
      });
      return;
    }
    applyResult(appendAgendaItems(items, incoming), incoming[0]?.key);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="secondary" size="sm" className="self-start" />}
      >
        <Plus data-icon="inline-start" />
        {t("addAgendaItem")}
        <ChevronDown data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={addTextItem}>{t("addAgendaText")}</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{t("addAgendaAssignment")}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-72 min-w-48 overflow-y-auto">
            {assignments.length === 0 ? (
              <DropdownMenuItem disabled>{t("addAgendaNoAssignments")}</DropdownMenuItem>
            ) : (
              <DropdownMenuGroup>
                {assignments.map((assignment) => (
                  <DropdownMenuItem key={assignment._id} onClick={() => addAssignment(assignment)}>
                    {assignment.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{t("addAgendaTask")}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-72 min-w-56 overflow-y-auto">
            {tasks.length === 0 ? (
              <DropdownMenuItem disabled>{t("addAgendaNoTasks")}</DropdownMenuItem>
            ) : (
              <>
                {ungrouped.length > 0 ? (
                  <DropdownMenuGroup>
                    {groups.length > 0 ? (
                      <DropdownMenuLabel>{t("addAgendaOtherTasks")}</DropdownMenuLabel>
                    ) : null}
                    {ungrouped.map((task) => (
                      <DropdownMenuItem key={task._id} onClick={() => addTask(task)}>
                        {task.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                ) : null}
                {groups.map((group) => (
                  <DropdownMenuGroup key={group.assignmentId}>
                    <DropdownMenuLabel>{group.assignmentName}</DropdownMenuLabel>
                    {group.tasks.map((task) => (
                      <DropdownMenuItem key={task._id} onClick={() => addTask(task)}>
                        {task.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                ))}
              </>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{t("addAgendaAssignmentTasks")}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-72 min-w-48 overflow-y-auto">
            {assignmentsWithTasks.length === 0 ? (
              <DropdownMenuItem disabled>{t("addAgendaNoAssignmentTasks")}</DropdownMenuItem>
            ) : (
              <DropdownMenuGroup>
                {assignmentsWithTasks.map((assignment) => (
                  <DropdownMenuItem
                    key={assignment._id}
                    onClick={() => addAssignmentTasks(assignment._id)}
                  >
                    {assignment.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
