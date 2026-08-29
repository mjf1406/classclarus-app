import { createFileRoute } from "@tanstack/react-router";

import { TimersPage } from "@/components/classroomScreen/TimersPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/timers")({
  component: function ClassTimersPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="classroomScreen:manage">
        <TimersPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
