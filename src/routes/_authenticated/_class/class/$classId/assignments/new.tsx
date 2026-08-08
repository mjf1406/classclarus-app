import { createFileRoute } from "@tanstack/react-router";

import { AssignmentFormPage } from "@/components/assignments/AssignmentFormPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/assignments/new")({
  component: function ClassAssignmentCreatePage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="assignments:manage">
        <AssignmentFormPage classId={typedClassId} mode="create" />
      </RequirePermission>
    );
  },
});
