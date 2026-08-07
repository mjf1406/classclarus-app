import { createFileRoute } from "@tanstack/react-router";

import { AnnouncementDetailPage } from "@/components/announcements/AnnouncementDetailPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/announcements/$announcementId",
)({
  component: function ClassAnnouncementDetailRoute() {
    const { classId, announcementId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;
    const typedAnnouncementId = announcementId as Id<"announcements">;

    return (
      <RequirePermission permission="class:read">
        <AnnouncementDetailPage classId={typedClassId} announcementId={typedAnnouncementId} />
      </RequirePermission>
    );
  },
});
