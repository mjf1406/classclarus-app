import { createFileRoute } from "@tanstack/react-router";

import { PointsPage } from "@/components/points/PointsPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import { pointsBoardQueryOptions } from "@/hooks/points/usePointsBoard";
import { preloadQuery } from "@/lib/routing/routePreload";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/points")({
  loader: ({ context, params }) => {
    if (!context.auth.isAuthenticated) {
      return;
    }
    const classId = params.classId as Id<"classes">;
    preloadQuery(context.queryClient, pointsBoardQueryOptions(classId));
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
