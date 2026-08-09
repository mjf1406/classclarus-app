import { createFileRoute } from "@tanstack/react-router";

import { AssignmentProcedureTasksPage } from "@/components/assignments/AssignmentProcedureTasksPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/assignments/$assignmentId/tasks",
)({
  component: function ClassAssignmentProcedureTasksPage() {
    const { classId, assignmentId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;
    const typedAssignmentId = assignmentId as Id<"assignments">;

    return (
      <RequirePermission permission="tasks:complete">
        <AssignmentProcedureTasksPage classId={typedClassId} assignmentId={typedAssignmentId} />
      </RequirePermission>
    );
  },
});
