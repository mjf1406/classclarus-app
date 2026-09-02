import { ClipboardCheck, Megaphone, Monitor, Star } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Can } from "@/components/permissions/Can";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

type StaffDashboardQuickActionsProps = {
  classId: Id<"classes">;
  onNewAnnouncement: () => void;
};

export function StaffDashboardQuickActions({
  classId,
  onNewAnnouncement,
}: StaffDashboardQuickActionsProps) {
  const { t } = useTranslation("classes");

  return (
    <div className="flex flex-wrap gap-2">
      <Can permission="attendance:manage">
        <Link
          to="/class/$classId/attendance"
          params={{ classId }}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <ClipboardCheck data-icon="inline-start" />
          {t("dashboardQuickTakeAttendance")}
        </Link>
      </Can>
      <Can permission="points:manage">
        <Link
          to="/class/$classId/points"
          params={{ classId }}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <Star data-icon="inline-start" />
          {t("dashboardQuickAwardPoints")}
        </Link>
      </Can>
      <Can permission="classroomScreen:read">
        <Link
          to="/class/$classId/classroom-screen"
          params={{ classId }}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <Monitor data-icon="inline-start" />
          {t("dashboardQuickClassroomScreen")}
        </Link>
      </Can>
      <Can permission="announcements:manage">
        <Button type="button" variant="outline" size="sm" onClick={onNewAnnouncement}>
          <Megaphone data-icon="inline-start" />
          {t("dashboardQuickNewAnnouncement")}
        </Button>
      </Can>
    </div>
  );
}
