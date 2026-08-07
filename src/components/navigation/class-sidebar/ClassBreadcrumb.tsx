import { Link, useRouterState } from "@tanstack/react-router";
import { Home } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { useTask } from "@/hooks/tasks/useTask";
import type { ClassDoc } from "@/lib/classes/classes";
import type { Id } from "../../../../convex/_generated/dataModel";

type ClassBreadcrumbProps = {
  classDoc: ClassDoc;
};

type BreadcrumbTarget =
  | { kind: "classesKey"; key: string }
  | { kind: "attendance" }
  | { kind: "announcements" }
  | { kind: "tasks" }
  | { kind: "taskDetail"; taskId: Id<"tasks"> };

function breadcrumbTarget(pathname: string, classId: string): BreadcrumbTarget {
  const base = `/class/${classId}`;
  if (pathname === base || pathname === `${base}/`) {
    return { kind: "classesKey", key: "navDashboard" };
  }
  if (pathname === `${base}/settings`) return { kind: "classesKey", key: "navSettings" };
  if (pathname === `${base}/activity`) return { kind: "classesKey", key: "navActivityLog" };
  if (pathname === `${base}/groups`) return { kind: "classesKey", key: "navGroups" };
  if (pathname === `${base}/teachers`) return { kind: "classesKey", key: "navTeachers" };
  if (pathname === `${base}/assistant-teachers`) {
    return { kind: "classesKey", key: "navAssistantTeachers" };
  }
  if (pathname === `${base}/students`) return { kind: "classesKey", key: "navStudents" };
  if (pathname === `${base}/guardians`) return { kind: "classesKey", key: "navGuardians" };
  if (pathname === `${base}/invitations`) return { kind: "classesKey", key: "navInvitations" };
  if (pathname === `${base}/attendance`) return { kind: "attendance" };
  if (pathname === `${base}/announcements` || pathname.startsWith(`${base}/announcements/`)) {
    return { kind: "announcements" };
  }
  if (pathname.startsWith(`${base}/tasks/`)) {
    const taskId = pathname.slice(`${base}/tasks/`.length).split("/")[0];
    if (taskId) {
      return { kind: "taskDetail", taskId: taskId as Id<"tasks"> };
    }
  }
  if (pathname === `${base}/tasks` || pathname === `${base}/tasks/`) {
    return { kind: "tasks" };
  }
  return { kind: "classesKey", key: "navDashboard" };
}

function TaskDetailBreadcrumbItems({
  classId,
  taskId,
  tasksLabel,
}: {
  classId: Id<"classes">;
  taskId: Id<"tasks">;
  tasksLabel: string;
}) {
  const { t: tTasks } = useTranslation("tasks");
  const { data: task, isPending } = useTask(classId, taskId);

  return (
    <>
      <BreadcrumbItem>
        <BreadcrumbLink
          render={
            <Link to="/class/$classId/tasks" params={{ classId }} className="max-w-40 truncate" />
          }
        >
          {tasksLabel}
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        <BreadcrumbPage className="max-w-48 truncate">
          {isPending && !task ? (
            <Skeleton className="inline-block h-4 w-24" />
          ) : (
            (task?.name ?? tTasks("notFoundTitle"))
          )}
        </BreadcrumbPage>
      </BreadcrumbItem>
    </>
  );
}

export function ClassBreadcrumb({ classDoc }: ClassBreadcrumbProps) {
  const { t } = useTranslation("classes");
  const { t: tAttendance } = useTranslation("attendance");
  const { t: tAnnouncements } = useTranslation("announcements");
  const { t: tTasks } = useTranslation("tasks");
  const { t: tCommon } = useTranslation("common");
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const target = breadcrumbTarget(pathname, classDoc._id);

  const pageLabel =
    target.kind === "attendance"
      ? tAttendance("nav")
      : target.kind === "announcements"
        ? tAnnouncements("nav")
        : target.kind === "tasks" || target.kind === "taskDetail"
          ? tTasks("nav")
          : t(target.key);

  return (
    <Breadcrumb aria-label={t("breadcrumb")}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link to="/" />} aria-label={tCommon("goHome")}>
            <Home className="size-4" />
            <span className="sr-only">{tCommon("goHome")}</span>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink
            render={
              <Link
                to="/class/$classId"
                params={{ classId: classDoc._id }}
                className="max-w-40 truncate"
              />
            }
          >
            {classDoc.name}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        {target.kind === "taskDetail" ? (
          <TaskDetailBreadcrumbItems
            classId={classDoc._id}
            taskId={target.taskId}
            tasksLabel={pageLabel}
          />
        ) : (
          <BreadcrumbItem>
            <BreadcrumbPage>{pageLabel}</BreadcrumbPage>
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
