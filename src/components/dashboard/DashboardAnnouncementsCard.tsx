import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { DashboardSectionCard } from "@/components/dashboard/DashboardSectionCard";
import { useRecentAnnouncements } from "@/hooks/announcements/useRecentAnnouncements";
import { formatLocalizedDateTime } from "@/i18n/formatDate";
import type { Id } from "../../../convex/_generated/dataModel";

type DashboardAnnouncementsCardProps = {
  classId: Id<"classes">;
};

export function DashboardAnnouncementsCard({ classId }: DashboardAnnouncementsCardProps) {
  const { t } = useTranslation("classes");
  const query = useRecentAnnouncements(classId);
  const announcements = query.data ?? [];
  const empty = !query.isPending && !query.isError && announcements.length === 0;

  return (
    <DashboardSectionCard
      title={t("dashboardAnnouncementsTitle")}
      viewAllLabel={t("dashboardViewAll")}
      viewAllTo="/class/$classId/announcements"
      viewAllParams={{ classId }}
      isPending={query.isPending}
      isError={query.isError}
      errorTitle={t("dashboardLoadFailed")}
      errorDescription={t("dashboardLoadFailedDescription")}
      onRetry={() => void query.refetch()}
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
