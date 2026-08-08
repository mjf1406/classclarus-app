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
import { useAssignment } from "@/hooks/assignments/useAssignment";
import { useExpectation } from "@/hooks/expectations/useExpectation";
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
  | { kind: "taskDetail"; taskId: Id<"tasks"> }
  | { kind: "assignments" }
  | { kind: "assignmentNew" }
  | { kind: "assignmentDetail"; assignmentId: Id<"assignments"> }
  | { kind: "assignmentEdit"; assignmentId: Id<"assignments"> }
  | { kind: "points" }
  | { kind: "behaviors" }
  | { kind: "rewards" }
  | { kind: "expectations" }
  | { kind: "expectationDetail"; expectationId: Id<"expectations"> };

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
  if (pathname === `${base}/assignments/new`) {
    return { kind: "assignmentNew" };
  }
  if (pathname.startsWith(`${base}/assignments/`)) {
    const rest = pathname.slice(`${base}/assignments/`.length);
    const [assignmentId, action] = rest.split("/");
    if (assignmentId) {
      if (action === "edit") {
        return {
          kind: "assignmentEdit",
          assignmentId: assignmentId as Id<"assignments">,
        };
      }
      return {
        kind: "assignmentDetail",
        assignmentId: assignmentId as Id<"assignments">,
      };
    }
  }
  if (pathname === `${base}/assignments` || pathname === `${base}/assignments/`) {
    return { kind: "assignments" };
  }
  if (pathname === `${base}/points` || pathname === `${base}/points/`) {
    return { kind: "points" };
  }
  if (pathname === `${base}/behaviors` || pathname === `${base}/behaviors/`) {
    return { kind: "behaviors" };
  }
  if (pathname === `${base}/rewards` || pathname === `${base}/rewards/`) {
    return { kind: "rewards" };
  }
  if (pathname.startsWith(`${base}/expectations/`)) {
    const expectationId = pathname.slice(`${base}/expectations/`.length).split("/")[0];
    if (expectationId) {
      return {
        kind: "expectationDetail",
        expectationId: expectationId as Id<"expectations">,
      };
    }
  }
  if (pathname === `${base}/expectations` || pathname === `${base}/expectations/`) {
    return { kind: "expectations" };
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

  const taskLabel = isPending && !task ? null : (task?.name ?? tTasks("notFoundTitle"));

  return (
    <>
      <BreadcrumbItem className="min-w-0">
        <BreadcrumbLink
          render={<Link to="/class/$classId/tasks" params={{ classId }} />}
          className="block truncate"
          title={tasksLabel}
        >
          {tasksLabel}
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator className="shrink-0" />
      <BreadcrumbItem className="min-w-0">
        <BreadcrumbPage className="block truncate" title={taskLabel ?? undefined}>
          {taskLabel === null ? <Skeleton className="inline-block h-4 w-24" /> : taskLabel}
        </BreadcrumbPage>
      </BreadcrumbItem>
    </>
  );
}

function ExpectationDetailBreadcrumbItems({
  classId,
  expectationId,
  expectationsLabel,
}: {
  classId: Id<"classes">;
  expectationId: Id<"expectations">;
  expectationsLabel: string;
}) {
  const { t: tExpectations } = useTranslation("expectations");
  const { data: expectation, isPending } = useExpectation(classId, expectationId);

  const expectationLabel =
    isPending && !expectation ? null : (expectation?.name ?? tExpectations("notFoundTitle"));

  return (
    <>
      <BreadcrumbItem className="min-w-0">
        <BreadcrumbLink
          render={<Link to="/class/$classId/expectations" params={{ classId }} />}
          className="block truncate"
          title={expectationsLabel}
        >
          {expectationsLabel}
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator className="shrink-0" />
      <BreadcrumbItem className="min-w-0">
        <BreadcrumbPage className="block truncate" title={expectationLabel ?? undefined}>
          {expectationLabel === null ? (
            <Skeleton className="inline-block h-4 w-24" />
          ) : (
            expectationLabel
          )}
        </BreadcrumbPage>
      </BreadcrumbItem>
    </>
  );
}

function AssignmentNewBreadcrumbItems({
  classId,
  assignmentsLabel,
}: {
  classId: Id<"classes">;
  assignmentsLabel: string;
}) {
  const { t: tAssignments } = useTranslation("assignments");
  const pageLabel = tAssignments("createTitle");

  return (
    <>
      <BreadcrumbItem className="min-w-0">
        <BreadcrumbLink
          render={<Link to="/class/$classId/assignments" params={{ classId }} />}
          className="block truncate"
          title={assignmentsLabel}
        >
          {assignmentsLabel}
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator className="shrink-0" />
      <BreadcrumbItem className="min-w-0">
        <BreadcrumbPage className="block truncate" title={pageLabel}>
          {pageLabel}
        </BreadcrumbPage>
      </BreadcrumbItem>
    </>
  );
}

function AssignmentDetailBreadcrumbItems({
  classId,
  assignmentId,
  assignmentsLabel,
  mode,
}: {
  classId: Id<"classes">;
  assignmentId: Id<"assignments">;
  assignmentsLabel: string;
  mode: "detail" | "edit";
}) {
  const { t: tAssignments } = useTranslation("assignments");
  const { data: assignment, isPending } = useAssignment(classId, assignmentId);

  const assignmentLabel =
    isPending && !assignment ? null : (assignment?.name ?? tAssignments("notFoundTitle"));
  const editLabel = tAssignments("editTitle");

  return (
    <>
      <BreadcrumbItem className="min-w-0">
        <BreadcrumbLink
          render={<Link to="/class/$classId/assignments" params={{ classId }} />}
          className="block truncate"
          title={assignmentsLabel}
        >
          {assignmentsLabel}
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator className="shrink-0" />
      {mode === "edit" ? (
        <>
          <BreadcrumbItem className="min-w-0">
            {assignmentLabel === null ? (
              <BreadcrumbPage className="block truncate">
                <Skeleton className="inline-block h-4 w-24" />
              </BreadcrumbPage>
            ) : (
              <BreadcrumbLink
                render={
                  <Link
                    to="/class/$classId/assignments/$assignmentId"
                    params={{ classId, assignmentId }}
                  />
                }
                className="block truncate"
                title={assignmentLabel}
              >
                {assignmentLabel}
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
          <BreadcrumbSeparator className="shrink-0" />
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="block truncate" title={editLabel}>
              {editLabel}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </>
      ) : (
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="block truncate" title={assignmentLabel ?? undefined}>
            {assignmentLabel === null ? (
              <Skeleton className="inline-block h-4 w-24" />
            ) : (
              assignmentLabel
            )}
          </BreadcrumbPage>
        </BreadcrumbItem>
      )}
    </>
  );
}

export function ClassBreadcrumb({ classDoc }: ClassBreadcrumbProps) {
  const { t } = useTranslation("classes");
  const { t: tAttendance } = useTranslation("attendance");
  const { t: tAnnouncements } = useTranslation("announcements");
  const { t: tTasks } = useTranslation("tasks");
  const { t: tAssignments } = useTranslation("assignments");
  const { t: tPoints } = useTranslation("points");
  const { t: tBehaviors } = useTranslation("behaviors");
  const { t: tRewards } = useTranslation("rewards");
  const { t: tExpectations } = useTranslation("expectations");
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
          : target.kind === "assignments" ||
              target.kind === "assignmentNew" ||
              target.kind === "assignmentDetail" ||
              target.kind === "assignmentEdit"
            ? tAssignments("nav")
            : target.kind === "points"
              ? tPoints("nav")
              : target.kind === "behaviors"
                ? tBehaviors("nav")
                : target.kind === "rewards"
                  ? tRewards("nav")
                  : target.kind === "expectations" || target.kind === "expectationDetail"
                    ? tExpectations("nav")
                    : t(target.key);

  return (
    <Breadcrumb aria-label={t("breadcrumb")} className="min-w-0">
      <BreadcrumbList className="flex-nowrap overflow-hidden">
        <BreadcrumbItem className="shrink-0">
          <BreadcrumbLink render={<Link to="/" />} aria-label={tCommon("goHome")}>
            <Home className="size-4" />
            <span className="sr-only">{tCommon("goHome")}</span>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="shrink-0" />
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbLink
            render={<Link to="/class/$classId" params={{ classId: classDoc._id }} />}
            className="block truncate"
            title={classDoc.name}
          >
            {classDoc.name}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="shrink-0" />
        {target.kind === "taskDetail" ? (
          <TaskDetailBreadcrumbItems
            classId={classDoc._id}
            taskId={target.taskId}
            tasksLabel={pageLabel}
          />
        ) : target.kind === "expectationDetail" ? (
          <ExpectationDetailBreadcrumbItems
            classId={classDoc._id}
            expectationId={target.expectationId}
            expectationsLabel={pageLabel}
          />
        ) : target.kind === "assignmentNew" ? (
          <AssignmentNewBreadcrumbItems classId={classDoc._id} assignmentsLabel={pageLabel} />
        ) : target.kind === "assignmentDetail" || target.kind === "assignmentEdit" ? (
          <AssignmentDetailBreadcrumbItems
            classId={classDoc._id}
            assignmentId={target.assignmentId}
            assignmentsLabel={pageLabel}
            mode={target.kind === "assignmentEdit" ? "edit" : "detail"}
          />
        ) : (
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="block truncate" title={pageLabel}>
              {pageLabel}
            </BreadcrumbPage>
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
