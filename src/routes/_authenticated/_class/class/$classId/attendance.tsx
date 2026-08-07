import { createFileRoute } from "@tanstack/react-router";

import { AttendancePage } from "@/components/attendance/AttendancePage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/attendance")({
  component: function ClassAttendancePage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="attendance:manage">
        <AttendancePage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
