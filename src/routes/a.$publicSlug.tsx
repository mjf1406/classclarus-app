import { createFileRoute } from "@tanstack/react-router";

import { PublicAnnouncementPage } from "@/components/announcements/PublicAnnouncementPage";

export const Route = createFileRoute("/a/$publicSlug")({
  component: function PublicAnnouncementRoute() {
    const { publicSlug } = Route.useParams();
    return <PublicAnnouncementPage publicSlug={publicSlug} />;
  },
});
