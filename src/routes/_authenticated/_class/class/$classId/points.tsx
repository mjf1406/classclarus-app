import { createFileRoute } from "@tanstack/react-router";

import { PointsPage } from "@/components/points/PointsPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/points")({
  component: function ClassPointsPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="points:manage">
        <PointsPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
