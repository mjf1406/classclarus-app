import { createFileRoute } from "@tanstack/react-router";

import { AttendancePage } from "@/components/attendance/AttendancePage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import { attendanceForAudienceQueryOptions } from "@/hooks/attendance/useAttendanceForAudience";
import { attendanceForDateQueryOptions } from "@/hooks/attendance/useAttendanceForDate";
import {
  cachedClassHasPermission,
  classPermissionsQueryOptions,
} from "@/hooks/permissions/useClassPermissions";
import { awaitPreloadQuery, preloadQuery } from "@/lib/routing/routePreload";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/attendance")({
  loader: async ({ context, params }) => {
    if (!context.auth.isAuthenticated) {
      return;
    }
    const classId = params.classId as Id<"classes">;
    await awaitPreloadQuery(context.queryClient, classPermissionsQueryOptions(classId));
    if (cachedClassHasPermission(context.queryClient, classId, "attendance:manage")) {
      preloadQuery(context.queryClient, attendanceForDateQueryOptions(classId));
    } else {
      preloadQuery(context.queryClient, attendanceForAudienceQueryOptions(classId));
    }
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
