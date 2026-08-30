import { createFileRoute } from "@tanstack/react-router";

import { RotationsPage } from "@/components/classroomScreen/RotationsPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/rotations")({
  component: function ClassRotationsPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="classroomScreen:manage">
        <RotationsPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
