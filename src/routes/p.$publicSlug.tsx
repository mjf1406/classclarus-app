import { createFileRoute } from "@tanstack/react-router";

import { PublicPointsDisplayPage } from "@/components/points/PublicPointsDisplayPage";

export const Route = createFileRoute("/p/$publicSlug")({
  component: function PublicPointsDisplayRoute() {
    const { publicSlug } = Route.useParams();
    return <PublicPointsDisplayPage publicSlug={publicSlug} />;
  },
});
