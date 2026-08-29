import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

import { TimetableTaggedText } from "@/components/timetable/TimetableTaggedText";
import { agendaNamedLinkLabel } from "@/lib/timetable/agendaItems";
import type { Id } from "../../../convex/_generated/dataModel";

const linkClassName =
  "inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline";

type TimetableAgendaItemViewProps = {
  classId: Id<"classes">;
  text: string;
  assignmentId?: string;
  taskId?: string;
  assignmentName?: string;
  taskName?: string;
  assignmentStatus?: ReactNode;
  taskStatus?: ReactNode;
};

export function TimetableAgendaItemView({
  classId,
  text,
  assignmentId,
  taskId,
  assignmentName,
  taskName,
  assignmentStatus,
  taskStatus,
}: TimetableAgendaItemViewProps) {
  const { t } = useTranslation("timetable");
  const title = text.trim();

  if (taskId) {
    const taskLabel = agendaNamedLinkLabel(taskName, title, t("linkKindTask"));
    return (
      <NamedResourceRow status={taskStatus}>
        <TaskLink classId={classId} taskId={taskId}>
          {taskLabel}
        </TaskLink>
      </NamedResourceRow>
    );
  }

  if (assignmentId) {
    const assignmentLabel = agendaNamedLinkLabel(assignmentName, title, t("linkKindAssignment"));
    return (
      <NamedResourceRow status={assignmentStatus}>
        <AssignmentLink classId={classId} assignmentId={assignmentId}>
          {assignmentLabel}
        </AssignmentLink>
      </NamedResourceRow>
    );
  }

  return title ? <TimetableTaggedText text={text} /> : null;
}

function NamedResourceRow({ children, status }: { children: ReactNode; status?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {children}
      {status}
    </div>
  );
}

function AssignmentLink({
  classId,
  assignmentId,
  children,
}: {
  classId: Id<"classes">;
  assignmentId: string;
  children: ReactNode;
}) {
  return (
    <Link
      to="/class/$classId/assignments/$assignmentId"
      params={{ classId, assignmentId: assignmentId as Id<"assignments"> }}
      target="_blank"
      rel="noopener noreferrer"
      className={linkClassName}
    >
      <span className="min-w-0 break-words">{children}</span>
      <ExternalLink className="size-3 shrink-0" aria-hidden />
    </Link>
  );
}

function TaskLink({
  classId,
  taskId,
  children,
}: {
  classId: Id<"classes">;
  taskId: string;
  children: ReactNode;
}) {
  return (
    <Link
      to="/class/$classId/tasks/$taskId"
      params={{ classId, taskId: taskId as Id<"tasks"> }}
      target="_blank"
      rel="noopener noreferrer"
      className={linkClassName}
    >
      <span className="min-w-0 break-words">{children}</span>
      <ExternalLink className="size-3 shrink-0" aria-hidden />
    </Link>
  );
}
