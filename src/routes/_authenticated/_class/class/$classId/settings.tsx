import { createFileRoute } from "@tanstack/react-router";

import { ClassSettingsPage } from "@/components/classes/ClassSettingsPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/settings")({
  component: function ClassSettingsRoute() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="class:update">
        <ClassSettingsPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
