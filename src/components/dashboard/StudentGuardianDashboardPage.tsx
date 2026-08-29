import { useState } from "react";
import { useTranslation } from "react-i18next";

import { DashboardAnnouncementsCard } from "@/components/dashboard/DashboardAnnouncementsCard";
import { DashboardAssignersCard } from "@/components/dashboard/DashboardAssignersCard";
import { DashboardAssignmentsCard } from "@/components/dashboard/DashboardAssignmentsCard";
import { DashboardCurrentSubjectCard } from "@/components/dashboard/DashboardCurrentSubjectCard";
import { DashboardEventsCard } from "@/components/dashboard/DashboardEventsCard";
import { DashboardPointsCard } from "@/components/dashboard/DashboardPointsCard";
import { DashboardRazCard } from "@/components/dashboard/DashboardRazCard";
import { DashboardTasksCard } from "@/components/dashboard/DashboardTasksCard";
import { PersonalStudentPicker } from "@/components/personal/PersonalStudentPicker";
import { useSeatPersonalStudentsForAudience } from "@/hooks/assigners/useSeatPersonalStudentsForAudience";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { resolveRosterNameFormat } from "@/lib/roster/roster";
import { isValidTimeZone } from "../../../convex/lib/calendar/timeZone";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { GC_TIME } from "@/lib/queryCache";

type StudentGuardianDashboardPageProps = {
  classId: Id<"classes">;
};

export function StudentGuardianDashboardPage({ classId }: StudentGuardianDashboardPageProps) {
  const { t } = useTranslation("classes");

  const { data: classDoc, isPending: classPending } = useAuthedQuery(
    api.classes.get,
    { classId },
    { gcTime: GC_TIME.stable },
  );
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
  const audiencePending = studentsQuery.isPending;

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
        <DashboardCurrentSubjectCard classId={classId} studentUserId={activeStudentId} />
        <DashboardAssignersCard
          classId={classId}
          studentUserId={activeStudentId}
          audiencePending={audiencePending}
        />
        <DashboardEventsCard classId={classId} timeZone={timeZone} classPending={classPending} />
        <DashboardAssignmentsCard
          classId={classId}
          studentUserId={activeStudentId}
          audiencePending={audiencePending}
        />
        <DashboardTasksCard classId={classId} studentUserId={activeStudentId} />
        <DashboardPointsCard
          classId={classId}
          studentUserId={activeStudentId}
          nameFormat={nameFormat}
          audiencePending={audiencePending}
        />
        <DashboardAnnouncementsCard classId={classId} />
        <DashboardRazCard
          classId={classId}
          studentUserId={activeStudentId}
          audiencePending={audiencePending}
        />
      </div>
    </div>
  );
}
