import { createFileRoute } from "@tanstack/react-router";

import { AssignersSeatsPage } from "@/components/assigners/AssignersSeatsPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/assigners/seats/layouts/",
)({
  component: function ClassAssignersSeatsLayoutsPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="assigners:read">
        <AssignersSeatsPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
