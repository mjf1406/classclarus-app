import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SeedTestStudentsButton } from "@/components/admin/SeedTestStudentsButton";
import { AnnouncementFormCredenza } from "@/components/announcements/AnnouncementFormCredenza";
import { DashboardActivityCard } from "@/components/dashboard/DashboardActivityCard";
import { DashboardAnnouncementsCard } from "@/components/dashboard/DashboardAnnouncementsCard";
import { DashboardAttendanceBanner } from "@/components/dashboard/DashboardAttendanceBanner";
import { DashboardCurrentSubjectCard } from "@/components/dashboard/DashboardCurrentSubjectCard";
import { DashboardEventsCard } from "@/components/dashboard/DashboardEventsCard";
import { DashboardNeedsGradingCard } from "@/components/dashboard/DashboardNeedsGradingCard";
import { DashboardRazDueCard } from "@/components/dashboard/DashboardRazDueCard";
import { DashboardThresholdAlertsCard } from "@/components/dashboard/DashboardThresholdAlertsCard";
import { DashboardTodayLessonsCard } from "@/components/dashboard/DashboardTodayLessonsCard";
import { StaffDashboardQuickActions } from "@/components/dashboard/StaffDashboardQuickActions";
import { Can } from "@/components/permissions/Can";
import { Button } from "@/components/ui/button";
import { useCreateAnnouncement } from "@/hooks/announcements/useCreateAnnouncement";
import { useClass } from "@/hooks/classes/useClass";
import { useCan } from "@/hooks/permissions/useCan";
import { isValidTimeZone } from "../../../convex/lib/calendar/timeZone";
import { resolveRosterNameFormat } from "@/lib/roster/roster";
import type { Id } from "../../../convex/_generated/dataModel";

type StaffDashboardPageProps = {
  classId: Id<"classes">;
};

export function StaffDashboardPage({ classId }: StaffDashboardPageProps) {
  const { t } = useTranslation("classes");
  const { can } = useCan();
  const { data: classDoc, isPending: classPending } = useClass(classId);
  const createAnnouncement = useCreateAnnouncement();
  const [createOpen, setCreateOpen] = useState(false);

  const nameFormat = resolveRosterNameFormat(classDoc ?? {});
  const timeZone =
    classDoc?.timezone && isValidTimeZone(classDoc.timezone) ? classDoc.timezone : "UTC";
  const canManageAnnouncements = can("announcements:manage");

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("navDashboard")}</h1>
          <p className="hidden text-muted-foreground sm:block">{t("dashboardStaffDescription")}</p>
        </div>
        {classDoc ? (
          <SeedTestStudentsButton classId={classId} classDisplayName={classDoc.name} />
        ) : null}
      </div>

      <Can permission="attendance:manage">
        <DashboardAttendanceBanner classId={classId} />
      </Can>

      <StaffDashboardQuickActions classId={classId} onNewAnnouncement={() => setCreateOpen(true)} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Can permission="classroomScreen:read">
          <DashboardCurrentSubjectCard classId={classId} studentUserId={null} />
        </Can>
        <Can permission="timetable:read">
          <DashboardTodayLessonsCard
            classId={classId}
            timeZone={timeZone}
            classPending={classPending}
          />
        </Can>
        <Can permission="assignments:manage">
          <DashboardNeedsGradingCard classId={classId} />
        </Can>
        <Can permission="points:manage">
          <DashboardThresholdAlertsCard
            classId={classId}
            nameFormat={nameFormat}
            warningAlerts={classDoc?.warningAlerts ?? []}
            minusAlerts={classDoc?.minusAlerts ?? []}
            classPending={classPending}
          />
        </Can>
        <Can permission="raz:read">
          <DashboardRazDueCard classId={classId} nameFormat={nameFormat} />
        </Can>
        <Can permission="calendar:read">
          <DashboardEventsCard classId={classId} timeZone={timeZone} classPending={classPending} />
        </Can>
        <DashboardAnnouncementsCard
          classId={classId}
          headerAction={
            canManageAnnouncements ? (
              <Button type="button" variant="outline" size="xs" onClick={() => setCreateOpen(true)}>
                <Plus />
                {t("dashboardNewAnnouncement")}
              </Button>
            ) : null
          }
        />
        <Can permission="activity:read">
          <DashboardActivityCard classId={classId} />
        </Can>
      </div>

      {canManageAnnouncements ? (
        <AnnouncementFormCredenza
          open={createOpen}
          onOpenChange={setCreateOpen}
          classId={classId}
          mode="create"
          onSubmit={async (values) => {
            await createAnnouncement.mutateAsync({
              classId,
              title: values.title,
              bodyJson: values.bodyJson,
              attachmentFileIds: values.attachmentFileIds,
              isPublic: values.isPublic,
            });
          }}
        />
      ) : null}
    </div>
  );
}
