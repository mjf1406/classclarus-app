import { createFileRoute } from "@tanstack/react-router";

import { AssignersSeatsChartsPage } from "@/components/assigners/AssignersSeatsChartsPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/assigners/seats/charts/",
)({
  component: function ClassAssignersSeatsChartsPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="assigners:read">
        <AssignersSeatsChartsPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
