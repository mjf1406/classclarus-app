import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { DashboardAssignersCard } from "@/components/dashboard/DashboardAssignersCard";
import { DashboardAnnouncementsCard } from "@/components/dashboard/DashboardAnnouncementsCard";
import { DashboardEventsCard } from "@/components/dashboard/DashboardEventsCard";
import { DashboardPointsCard } from "@/components/dashboard/DashboardPointsCard";
import { DashboardRazCard } from "@/components/dashboard/DashboardRazCard";
import { DashboardTasksCard } from "@/components/dashboard/DashboardTasksCard";
import { PersonalStudentPicker } from "@/components/personal/PersonalStudentPicker";
import { useRecentAnnouncements } from "@/hooks/announcements/useRecentAnnouncements";
import { useCalendarEventsInRange } from "@/hooks/calendar/useCalendarEventsInRange";
import { useDashboardAssignerSnapshot } from "@/hooks/dashboard/useDashboardAssignerSnapshot";
import { usePointsForAudience } from "@/hooks/points/usePointsForAudience";
import { useRazForAudience } from "@/hooks/raz/useRazForAudience";
import { useSeatPersonalStudentsForAudience } from "@/hooks/assigners/useSeatPersonalStudentsForAudience";
import { useTasks } from "@/hooks/tasks/useTasks";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { localDateKey } from "@/lib/attendance/dateKey";
import {
  dashboardEventRange,
  recentDashboardTasks,
  upcomingDashboardEvents,
} from "@/lib/dashboard/dashboard";
import { ONE_HOUR } from "@/lib/queryCache";
import { resolveRosterNameFormat } from "@/lib/roster/roster";
import { isValidTimeZone } from "../../../convex/lib/calendar/timeZone";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type StudentGuardianDashboardPageProps = {
  classId: Id<"classes">;
};

export function StudentGuardianDashboardPage({ classId }: StudentGuardianDashboardPageProps) {
  const { t, i18n } = useTranslation("classes");
  const nowMs = Date.now();
  const dateKey = useMemo(() => localDateKey(), []);
  const eventRange = useMemo(() => dashboardEventRange(nowMs), [nowMs]);

  const { data: classDoc } = useAuthedQuery(api.classes.get, { classId }, { gcTime: ONE_HOUR });
  const studentsQuery = useSeatPersonalStudentsForAudience(classId);
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(null);

  const students = studentsQuery.data ?? [];
  const activeStudentId =
    selectedUserId && students.some((student) => student.userId === selectedUserId)
      ? selectedUserId
      : (students[0]?.userId ?? null);

  const nameFormat = resolveRosterNameFormat(classDoc ?? {});
  const timeZone =
    classDoc?.timezone && isValidTimeZone(classDoc.timezone) ? classDoc.timezone : "UTC";

  const assignersQuery = useDashboardAssignerSnapshot(classId, activeStudentId);
  const eventsQuery = useCalendarEventsInRange(
    classId,
    eventRange.rangeStartMs,
    eventRange.rangeEndMs,
  );
  const tasksQuery = useTasks(classId);
  const pointsQuery = usePointsForAudience(classId, dateKey);
  const announcementsQuery = useRecentAnnouncements(classId);
  const razQuery = useRazForAudience(classId);

  const upcomingEvents = useMemo(
    () => upcomingDashboardEvents(eventsQuery.data ?? [], nowMs, timeZone),
    [eventsQuery.data, nowMs, timeZone],
  );
  const recentTasks = useMemo(() => recentDashboardTasks(tasksQuery.data ?? []), [tasksQuery.data]);
  const activePointsStudent = useMemo(
    () => (pointsQuery.data ?? []).find((student) => student.userId === activeStudentId) ?? null,
    [activeStudentId, pointsQuery.data],
  );
  const activeRazStudent = useMemo(
    () => (razQuery.data ?? []).find((student) => student.userId === activeStudentId) ?? null,
    [activeStudentId, razQuery.data],
  );

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("navDashboard")}</h1>
        <p className="hidden text-muted-foreground sm:block">{t("dashboardDescription")}</p>
      </div>

      {students.length >= 2 && activeStudentId ? (
        <PersonalStudentPicker
          students={students}
          selectedUserId={activeStudentId}
          nameFormat={nameFormat}
          onSelect={setSelectedUserId}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardAssignersCard
          classId={classId}
          snapshot={assignersQuery.data}
          isPending={Boolean(activeStudentId) && assignersQuery.isPending}
          isError={assignersQuery.isError}
          onRetry={() => void assignersQuery.refetch()}
        />
        <DashboardEventsCard
          classId={classId}
          events={upcomingEvents}
          timeZone={timeZone}
          locale={i18n.language}
          isPending={eventsQuery.isPending}
          isError={eventsQuery.isError}
          onRetry={() => void eventsQuery.refetch()}
        />
        <DashboardTasksCard
          classId={classId}
          tasks={recentTasks}
          studentUserId={activeStudentId}
          isPending={tasksQuery.isPending}
          isError={tasksQuery.isError}
          onRetry={() => void tasksQuery.refetch()}
        />
        <DashboardPointsCard
          classId={classId}
          student={activePointsStudent}
          nameFormat={nameFormat}
          isPending={pointsQuery.isPending}
          isError={pointsQuery.isError}
          onRetry={() => void pointsQuery.refetch()}
        />
        <DashboardAnnouncementsCard
          classId={classId}
          announcements={announcementsQuery.data ?? []}
          isPending={announcementsQuery.isPending}
          isError={announcementsQuery.isError}
          onRetry={() => void announcementsQuery.refetch()}
        />
        <DashboardRazCard
          classId={classId}
          student={activeRazStudent}
          language={i18n.language}
          isPending={razQuery.isPending}
          isError={razQuery.isError}
          onRetry={() => void razQuery.refetch()}
        />
      </div>
    </div>
  );
}
