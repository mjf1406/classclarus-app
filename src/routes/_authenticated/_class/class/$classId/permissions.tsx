import { createFileRoute } from "@tanstack/react-router";

import { ClassPermissionsPage } from "@/components/permissions/ClassPermissionsPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/permissions")({
  component: function ClassPermissionsRoute() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="permissions:manage">
        <ClassPermissionsPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
