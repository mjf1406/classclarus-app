import { createFileRoute } from "@tanstack/react-router";

import { TimetablePage } from "@/components/timetable/TimetablePage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/timetable/")({
  component: function ClassTimetablePage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="timetable:read">
        <TimetablePage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
