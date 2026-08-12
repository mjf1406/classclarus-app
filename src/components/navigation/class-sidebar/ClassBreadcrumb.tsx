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
import { useEquitableAssigner } from "@/hooks/assigners/equitable/useEquitableAssigners";
import { useSeatLayout } from "@/hooks/assigners/useSeatLayout";
import { useSeatChart } from "@/hooks/assigners/useSeatChart";
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
  | { kind: "assignmentGrade"; assignmentId: Id<"assignments"> }
  | { kind: "assignmentTasks"; assignmentId: Id<"assignments"> }
  | { kind: "points" }
  | { kind: "behaviors" }
  | { kind: "rewards" }
  | { kind: "expectations" }
  | { kind: "expectationDetail"; expectationId: Id<"expectations"> }
  | { kind: "raz" }
  | { kind: "razInitialLevels" }
  | { kind: "assignersSeats" }
  | { kind: "assignersRandom" }
  | { kind: "assignersEquitable" }
  | { kind: "assignersEquitableNew" }
  | { kind: "equitableAssignerDetail"; assignerId: Id<"equitableAssigners"> }
  | { kind: "equitableAssignerEdit"; assignerId: Id<"equitableAssigners"> }
  | { kind: "equitableAssignerManual"; assignerId: Id<"equitableAssigners"> }
  | { kind: "studentWorkGradeScales" }
  | { kind: "studentWorkGradedSubjects" }
  | { kind: "seatLayoutDetail"; layoutId: Id<"seatLayouts"> }
  | { kind: "seatChartDetail"; chartId: Id<"seatCharts"> };

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
      if (action === "grade") {
        return {
          kind: "assignmentGrade",
          assignmentId: assignmentId as Id<"assignments">,
        };
      }
      if (action === "tasks") {
        return {
          kind: "assignmentTasks",
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
  if (pathname === `${base}/raz/initial-levels`) {
    return { kind: "razInitialLevels" };
  }
  if (pathname === `${base}/raz` || pathname === `${base}/raz/`) {
    return { kind: "raz" };
  }
  if (pathname.startsWith(`${base}/assigners/seats/layouts/`)) {
    const layoutId = pathname.slice(`${base}/assigners/seats/layouts/`.length).split("/")[0];
    if (layoutId) {
      return { kind: "seatLayoutDetail", layoutId: layoutId as Id<"seatLayouts"> };
    }
  }
  if (pathname.startsWith(`${base}/assigners/seats/charts/`)) {
    const chartId = pathname.slice(`${base}/assigners/seats/charts/`.length).split("/")[0];
    if (chartId) {
      return { kind: "seatChartDetail", chartId: chartId as Id<"seatCharts"> };
    }
  }
  if (
    pathname === `${base}/assigners/random` ||
    pathname === `${base}/assigners/random/` ||
    pathname.startsWith(`${base}/assigners/random/`)
  ) {
    return { kind: "assignersRandom" };
  }
  if (pathname === `${base}/assigners/equitable` || pathname === `${base}/assigners/equitable/`) {
    return { kind: "assignersEquitable" };
  }
  if (pathname.startsWith(`${base}/assigners/equitable/`)) {
    const rest = pathname.slice(`${base}/assigners/equitable/`.length);
    if (rest === "new" || rest.startsWith("new/")) {
      return { kind: "assignersEquitableNew" };
    }
    const [assignerId, action] = rest.split("/");
    if (assignerId) {
      if (action === "edit") {
        return {
          kind: "equitableAssignerEdit",
          assignerId: assignerId as Id<"equitableAssigners">,
        };
      }
      if (action === "manual") {
        return {
          kind: "equitableAssignerManual",
          assignerId: assignerId as Id<"equitableAssigners">,
        };
      }
      if (action === "dashboard" || action === "data" || !action) {
        return {
          kind: "equitableAssignerDetail",
          assignerId: assignerId as Id<"equitableAssigners">,
        };
      }
    }
  }
  if (
    pathname === `${base}/assigners/seats` ||
    pathname === `${base}/assigners/seats/` ||
    pathname === `${base}/assigners/seats/layouts` ||
    pathname === `${base}/assigners/seats/layouts/` ||
    pathname === `${base}/assigners/seats/constraints` ||
    pathname === `${base}/assigners/seats/constraints/` ||
    pathname === `${base}/assigners/seats/charts` ||
    pathname === `${base}/assigners/seats/charts/`
  ) {
    return { kind: "assignersSeats" };
  }
  if (
    pathname === `${base}/sw/graded-subjects` ||
    pathname === `${base}/sw/graded-subjects/` ||
    pathname.startsWith(`${base}/sw/graded-subjects/`)
  ) {
    return { kind: "studentWorkGradedSubjects" };
  }
  if (
    pathname === `${base}/sw/grade-scales` ||
    pathname === `${base}/sw/grade-scales/` ||
    pathname === `${base}/sw/grade-scales/scales` ||
    pathname === `${base}/sw/grade-scales/scales/` ||
    pathname === `${base}/sw/grade-scales/subjects` ||
    pathname === `${base}/sw/grade-scales/subjects/` ||
    pathname === `${base}/sw/grade-scales/reports` ||
    pathname === `${base}/sw/grade-scales/reports/`
  ) {
    return { kind: "studentWorkGradeScales" };
  }
  return { kind: "classesKey", key: "navDashboard" };
}

function SeatChartDetailBreadcrumbItems({
  classId,
  chartId,
  seatsLabel,
}: {
  classId: Id<"classes">;
  chartId: Id<"seatCharts">;
  seatsLabel: string;
}) {
  const { t: tAssigners } = useTranslation("assigners");
  const { data: chart, isPending } = useSeatChart(classId, chartId);
  const chartLabel = isPending && !chart ? null : (chart?.name ?? tAssigners("chartNotFound"));

  return (
    <>
      <BreadcrumbItem className="min-w-0">
        <BreadcrumbLink
          render={<Link to="/class/$classId/assigners/seats/charts" params={{ classId }} />}
          className="block truncate"
          title={seatsLabel}
        >
          {seatsLabel}
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator className="shrink-0" />
      <BreadcrumbItem className="min-w-0">
        <BreadcrumbPage className="block truncate" title={chartLabel ?? undefined}>
          {chartLabel === null ? <Skeleton className="inline-block h-4 w-24" /> : chartLabel}
        </BreadcrumbPage>
      </BreadcrumbItem>
    </>
  );
}

function SeatLayoutDetailBreadcrumbItems({
  classId,
  layoutId,
  seatsLabel,
}: {
  classId: Id<"classes">;
  layoutId: Id<"seatLayouts">;
  seatsLabel: string;
}) {
  const { t: tAssigners } = useTranslation("assigners");
  const { data: layout, isPending } = useSeatLayout(classId, layoutId);
  const layoutLabel = isPending && !layout ? null : (layout?.name ?? tAssigners("layoutNotFound"));

  return (
    <>
      <BreadcrumbItem className="min-w-0">
        <BreadcrumbLink
          render={<Link to="/class/$classId/assigners/seats/layouts" params={{ classId }} />}
          className="block truncate"
          title={seatsLabel}
        >
          {seatsLabel}
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator className="shrink-0" />
      <BreadcrumbItem className="min-w-0">
        <BreadcrumbPage className="block truncate" title={layoutLabel ?? undefined}>
          {layoutLabel === null ? <Skeleton className="inline-block h-4 w-24" /> : layoutLabel}
        </BreadcrumbPage>
      </BreadcrumbItem>
    </>
  );
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

function RazInitialLevelsBreadcrumbItems({
  classId,
  razLabel,
}: {
  classId: Id<"classes">;
  razLabel: string;
}) {
  const { t: tRaz } = useTranslation("raz");
  const pageLabel = tRaz("initialLevelsTitle");

  return (
    <>
      <BreadcrumbItem className="min-w-0">
        <BreadcrumbLink
          render={<Link to="/class/$classId/raz" params={{ classId }} />}
          className="block truncate"
          title={razLabel}
        >
          {razLabel}
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

function EquitableAssignerBreadcrumbItems({
  classId,
  assignerId,
  equitableLabel,
  mode,
}: {
  classId: Id<"classes">;
  assignerId: Id<"equitableAssigners">;
  equitableLabel: string;
  mode: "detail" | "edit" | "manual";
}) {
  const { t: tAssigners } = useTranslation("assigners");
  const { data: assigner, isPending } = useEquitableAssigner(classId, assignerId);

  const assignerLabel =
    isPending && !assigner ? null : (assigner?.name ?? tAssigners("equitableNotFoundTitle"));
  const actionLabel =
    mode === "edit"
      ? tAssigners("equitableEdit")
      : mode === "manual"
        ? tAssigners("equitableManualAction")
        : null;

  return (
    <>
      <BreadcrumbItem className="min-w-0">
        <BreadcrumbLink
          render={<Link to="/class/$classId/assigners/equitable" params={{ classId }} />}
          className="block truncate"
          title={equitableLabel}
        >
          {equitableLabel}
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator className="shrink-0" />
      {actionLabel ? (
        <>
          <BreadcrumbItem className="min-w-0">
            {assignerLabel === null ? (
              <BreadcrumbPage className="block truncate">
                <Skeleton className="inline-block h-4 w-24" />
              </BreadcrumbPage>
            ) : (
              <BreadcrumbLink
                render={
                  <Link
                    to="/class/$classId/assigners/equitable/$assignerId/dashboard"
                    params={{ classId, assignerId }}
                  />
                }
                className="block truncate"
                title={assignerLabel}
              >
                {assignerLabel}
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
          <BreadcrumbSeparator className="shrink-0" />
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="block truncate" title={actionLabel}>
              {actionLabel}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </>
      ) : (
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="block truncate" title={assignerLabel ?? undefined}>
            {assignerLabel === null ? (
              <Skeleton className="inline-block h-4 w-24" />
            ) : (
              assignerLabel
            )}
          </BreadcrumbPage>
        </BreadcrumbItem>
      )}
    </>
  );
}

function EquitableAssignerNewBreadcrumbItems({
  classId,
  equitableLabel,
}: {
  classId: Id<"classes">;
  equitableLabel: string;
}) {
  const { t: tAssigners } = useTranslation("assigners");
  const pageLabel = tAssigners("equitableCreate");

  return (
    <>
      <BreadcrumbItem className="min-w-0">
        <BreadcrumbLink
          render={<Link to="/class/$classId/assigners/equitable" params={{ classId }} />}
          className="block truncate"
          title={equitableLabel}
        >
          {equitableLabel}
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
  mode: "detail" | "edit" | "grade" | "tasks";
}) {
  const { t: tAssignments } = useTranslation("assignments");
  const { data: assignment, isPending } = useAssignment(classId, assignmentId);

  const assignmentLabel =
    isPending && !assignment ? null : (assignment?.name ?? tAssignments("notFoundTitle"));
  const actionLabel =
    mode === "edit"
      ? tAssignments("editTitle")
      : mode === "grade"
        ? tAssignments("gradeTitle")
        : mode === "tasks"
          ? tAssignments("procedureTasksTitle")
          : null;

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
      {actionLabel ? (
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
            <BreadcrumbPage className="block truncate" title={actionLabel}>
              {actionLabel}
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
  const { t: tRaz } = useTranslation("raz");
  const { t: tAssigners } = useTranslation("assigners");
  const { t: tStudentWork } = useTranslation("studentWork");
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
              target.kind === "assignmentEdit" ||
              target.kind === "assignmentGrade" ||
              target.kind === "assignmentTasks"
            ? tAssignments("nav")
            : target.kind === "points"
              ? tPoints("nav")
              : target.kind === "behaviors"
                ? tBehaviors("nav")
                : target.kind === "rewards"
                  ? tRewards("nav")
                  : target.kind === "expectations" || target.kind === "expectationDetail"
                    ? tExpectations("nav")
                    : target.kind === "raz" || target.kind === "razInitialLevels"
                      ? tRaz("nav")
                      : target.kind === "assignersSeats" ||
                          target.kind === "seatLayoutDetail" ||
                          target.kind === "seatChartDetail"
                        ? tAssigners("navSeats")
                        : target.kind === "assignersRandom"
                          ? tAssigners("navRandom")
                          : target.kind === "assignersEquitable" ||
                              target.kind === "assignersEquitableNew" ||
                              target.kind === "equitableAssignerDetail" ||
                              target.kind === "equitableAssignerEdit" ||
                              target.kind === "equitableAssignerManual"
                            ? tAssigners("navEquitable")
                            : target.kind === "studentWorkGradeScales"
                              ? tStudentWork("navGradeScales")
                              : target.kind === "studentWorkGradedSubjects"
                                ? tStudentWork("navGradedSubjects")
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
        ) : target.kind === "assignmentDetail" ||
          target.kind === "assignmentEdit" ||
          target.kind === "assignmentGrade" ||
          target.kind === "assignmentTasks" ? (
          <AssignmentDetailBreadcrumbItems
            classId={classDoc._id}
            assignmentId={target.assignmentId}
            assignmentsLabel={pageLabel}
            mode={
              target.kind === "assignmentEdit"
                ? "edit"
                : target.kind === "assignmentGrade"
                  ? "grade"
                  : target.kind === "assignmentTasks"
                    ? "tasks"
                    : "detail"
            }
          />
        ) : target.kind === "razInitialLevels" ? (
          <RazInitialLevelsBreadcrumbItems classId={classDoc._id} razLabel={pageLabel} />
        ) : target.kind === "seatChartDetail" ? (
          <SeatChartDetailBreadcrumbItems
            classId={classDoc._id}
            chartId={target.chartId}
            seatsLabel={pageLabel}
          />
        ) : target.kind === "seatLayoutDetail" ? (
          <SeatLayoutDetailBreadcrumbItems
            classId={classDoc._id}
            layoutId={target.layoutId}
            seatsLabel={pageLabel}
          />
        ) : target.kind === "assignersEquitableNew" ? (
          <EquitableAssignerNewBreadcrumbItems classId={classDoc._id} equitableLabel={pageLabel} />
        ) : target.kind === "equitableAssignerDetail" ||
          target.kind === "equitableAssignerEdit" ||
          target.kind === "equitableAssignerManual" ? (
          <EquitableAssignerBreadcrumbItems
            classId={classDoc._id}
            assignerId={target.assignerId}
            equitableLabel={pageLabel}
            mode={
              target.kind === "equitableAssignerEdit"
                ? "edit"
                : target.kind === "equitableAssignerManual"
                  ? "manual"
                  : "detail"
            }
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
