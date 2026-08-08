import { createFileRoute } from "@tanstack/react-router";

import { AssignmentDetailPage } from "@/components/assignments/AssignmentDetailPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/assignments/$assignmentId/",
)({
  component: function ClassAssignmentDetailPage() {
    const { classId, assignmentId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;
    const typedAssignmentId = assignmentId as Id<"assignments">;

    return (
      <RequirePermission permission="class:read">
        <AssignmentDetailPage classId={typedClassId} assignmentId={typedAssignmentId} />
      </RequirePermission>
    );
  },
});
