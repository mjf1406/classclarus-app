import { createFileRoute } from "@tanstack/react-router";

import { PointsPage } from "@/components/points/PointsPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import {
  cachedClassHasPermission,
  classPermissionsQueryOptions,
} from "@/hooks/permissions/useClassPermissions";
import { pointsForAudienceQueryOptions } from "@/hooks/points/usePointsForAudience";
import { pointsBoardQueryOptions } from "@/hooks/points/usePointsBoard";
import { awaitPreloadQuery, preloadQuery } from "@/lib/routing/routePreload";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/points")({
  loader: async ({ context, params }) => {
    if (!context.auth.isAuthenticated) {
      return;
    }
    const classId = params.classId as Id<"classes">;
    await awaitPreloadQuery(context.queryClient, classPermissionsQueryOptions(classId));
    if (cachedClassHasPermission(context.queryClient, classId, "points:manage")) {
      preloadQuery(context.queryClient, pointsBoardQueryOptions(classId));
    } else {
      preloadQuery(context.queryClient, pointsForAudienceQueryOptions(classId));
    }
  },
  component: function ClassPointsPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="points:read">
        <PointsPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
