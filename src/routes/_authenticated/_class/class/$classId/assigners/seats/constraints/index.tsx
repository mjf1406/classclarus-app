import { createFileRoute } from "@tanstack/react-router";

import { AssignersSeatsConstraintsPage } from "@/components/assigners/AssignersSeatsConstraintsPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/assigners/seats/constraints/",
)({
  component: function ClassAssignersSeatsConstraintsPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="students:read">
        <AssignersSeatsConstraintsPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
