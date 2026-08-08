import { createFileRoute } from "@tanstack/react-router";

import { AssignmentGradePage } from "@/components/assignments/AssignmentGradePage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/assignments/$assignmentId/grade",
)({
  component: function ClassAssignmentGradePage() {
    const { classId, assignmentId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;
    const typedAssignmentId = assignmentId as Id<"assignments">;

    return (
      <RequirePermission permission="assignments:manage">
        <AssignmentGradePage classId={typedClassId} assignmentId={typedAssignmentId} />
      </RequirePermission>
    );
  },
});
