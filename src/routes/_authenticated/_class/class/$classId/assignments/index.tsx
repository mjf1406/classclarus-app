import { createFileRoute } from "@tanstack/react-router";

import { AssignmentsPage } from "@/components/assignments/AssignmentsPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/assignments/")({
  component: function ClassAssignmentsPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="class:read">
        <AssignmentsPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
