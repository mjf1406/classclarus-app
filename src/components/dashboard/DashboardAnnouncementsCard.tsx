import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { DashboardSectionCard } from "@/components/dashboard/DashboardSectionCard";
import { formatLocalizedDateTime } from "@/i18n/formatDate";
import type { RecentAnnouncementList } from "@/lib/announcements/announcements";
import type { Id } from "../../../convex/_generated/dataModel";

type DashboardAnnouncementsCardProps = {
  classId: Id<"classes">;
  announcements: RecentAnnouncementList;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
};

export function DashboardAnnouncementsCard({
  classId,
  announcements,
  isPending,
  isError,
  onRetry,
}: DashboardAnnouncementsCardProps) {
  const { t } = useTranslation("classes");
  const empty = !isPending && !isError && announcements.length === 0;

  return (
    <DashboardSectionCard
      title={t("dashboardAnnouncementsTitle")}
      viewAllLabel={t("dashboardViewAll")}
      viewAllTo="/class/$classId/announcements"
      viewAllParams={{ classId }}
      isPending={isPending}
      isError={isError}
      errorTitle={t("dashboardLoadFailed")}
      errorDescription={t("dashboardLoadFailedDescription")}
      onRetry={onRetry}
      empty={empty}
      emptyTitle={t("dashboardNoAnnouncementsTitle")}
      emptyDescription={t("dashboardNoAnnouncementsDescription")}
    >
      {announcements.map((announcement) => (
        <Link
          key={announcement._id}
          to="/class/$classId/announcements/$announcementId"
          params={{ classId, announcementId: announcement._id }}
          className="flex flex-col gap-1 rounded-xl border px-3 py-2 transition-colors hover:bg-accent/40"
        >
          <span className="text-sm font-medium">{announcement.title}</span>
          <span className="text-xs text-muted-foreground">
            {formatLocalizedDateTime(announcement.createdAt)}
          </span>
        </Link>
      ))}
    </DashboardSectionCard>
  );
}
