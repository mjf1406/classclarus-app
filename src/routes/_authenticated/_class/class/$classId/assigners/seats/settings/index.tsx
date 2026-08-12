import { createFileRoute } from "@tanstack/react-router";

import { AssignersSeatsSettingsPage } from "@/components/assigners/AssignersSeatsSettingsPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/assigners/seats/settings/",
)({
  component: function ClassAssignersSeatsSettingsPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="students:read">
        <AssignersSeatsSettingsPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
