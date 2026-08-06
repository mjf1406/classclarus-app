import { createFileRoute } from "@tanstack/react-router";

import { ActivityLogPage } from "@/components/activity/ActivityLogPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/activity")({
  component: function ClassActivityPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="activity:read">
        <ActivityLogPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
