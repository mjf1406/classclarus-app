import { createFileRoute } from "@tanstack/react-router";

import { ClassroomScreenPage } from "@/components/classroomScreen/ClassroomScreenPage";
import { ClassPermissionsProvider } from "@/components/permissions/ClassPermissionsProvider";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/class/$classId_/classroom-screen")({
  component: function ClassroomScreenRoute() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <ClassPermissionsProvider classId={typedClassId}>
        <RequirePermission permission="classroomScreen:read">
          <ClassroomScreenPage classId={typedClassId} />
        </RequirePermission>
      </ClassPermissionsProvider>
    );
  },
});
