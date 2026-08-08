import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { TaskCompletionStatusBadge } from "@/components/tasks/TaskCompletionStatusBadge";
import {
  TASK_COMPLETION_CARD_RING_CLASS,
  completionTone,
} from "@/components/tasks/taskCompletionTone";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatLocalizedDateTime } from "@/i18n/formatDate";
import { isTaskPastDue, type TaskListItem } from "@/lib/tasks/tasks";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

type TaskCardProps = {
  classId: Id<"classes">;
  task: TaskListItem;
  personalView: boolean;
  onEdit: (task: TaskListItem) => void;
  onDelete: (task: TaskListItem) => void;
};

export function TaskCard({ classId, task, personalView, onEdit, onDelete }: TaskCardProps) {
  const { t } = useTranslation("tasks");
  const navigate = useNavigate();

  const menuItems = useMemo<Array<ActionMenuItem>>(
    () => [
      {
        id: "view",
        label: t("viewAction"),
        icon: <Eye />,
        group: "navigate",
        onSelect: () => {
          void navigate({
            to: "/class/$classId/tasks/$taskId",
            params: { classId, taskId: task._id },
          });
        },
      },
      {
        id: "edit",
        label: t("editAction"),
        icon: <Pencil />,
        permission: "tasks:manage",
        group: "manage",
        onSelect: () => onEdit(task),
      },
      {
        id: "delete",
        label: t("deleteAction"),
        icon: <Trash2 />,
        permission: "tasks:manage",
        variant: "destructive",
        group: "danger",
        onSelect: () => onDelete(task),
      },
    ],
    [classId, navigate, onDelete, onEdit, t, task],
  );

  const description = task.description?.trim() || t("emptyDescriptionPreview");
  const allDone = task.studentCount > 0 && task.completedCount >= task.studentCount;
  const pastDue = isTaskPastDue(task.dueDateKey);
  const personalTone =
    personalView && task.studentCount > 0 ? completionTone(allDone, pastDue) : null;

  return (
    <Card
      size="sm"
      className={cn(
        "transition-colors hover:bg-accent/40",
        personalTone ? TASK_COMPLETION_CARD_RING_CLASS[personalTone] : null,
      )}
    >
      <CardHeader className="flex flex-row items-start gap-3">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base font-semibold">
            <Link
              to="/class/$classId/tasks/$taskId"
              params={{ classId, taskId: task._id }}
              className="rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {task.name}
            </Link>
          </CardTitle>
          <CardDescription className="mt-1 line-clamp-2">{description}</CardDescription>
        </div>
        <div className="shrink-0">
          <ActionMenu items={menuItems} label={t("actions")} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
        {personalView && task.studentCount > 0 ? (
          <TaskCompletionStatusBadge
            completed={allDone}
            pastDue={pastDue}
            label={
              task.studentCount <= 1
                ? undefined
                : t("statsCompleted", {
                    completed: task.completedCount,
                    total: task.studentCount,
                  })
            }
          />
        ) : (
          <p>
            {t("statsCompleted", {
              completed: task.completedCount,
              total: task.studentCount,
            })}
          </p>
        )}
        {task.dueDateKey ? <p>{t("dueDateValue", { date: task.dueDateKey })}</p> : null}
      </CardContent>
      <CardFooter className="border-t text-xs text-muted-foreground">
        {t("updatedAt", { date: formatLocalizedDateTime(task.updatedAt) })}
      </CardFooter>
    </Card>
  );
}
