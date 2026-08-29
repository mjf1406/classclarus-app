import { createFileRoute } from "@tanstack/react-router";

import { AttendancePage } from "@/components/attendance/AttendancePage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import { attendanceForDateQueryOptions } from "@/hooks/attendance/useAttendanceForDate";
import { preloadQuery } from "@/lib/routing/routePreload";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/attendance")({
  loader: ({ context, params }) => {
    if (!context.auth.isAuthenticated) {
      return;
    }
    const classId = params.classId as Id<"classes">;
    preloadQuery(context.queryClient, attendanceForDateQueryOptions(classId));
  },
  component: function ClassAttendancePage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="attendance:read">
        <AttendancePage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
