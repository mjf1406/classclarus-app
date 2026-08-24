import { createFileRoute } from "@tanstack/react-router";

import { CalendarEventDetailPage } from "@/components/calendar/CalendarEventDetailPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/calendar/event/$eventId",
)({
  component: function ClassCalendarEventDetailRoute() {
    const { classId, eventId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;
    const typedEventId = eventId as Id<"calendarEvents">;

    return (
      <RequirePermission permission="calendar:read">
        <CalendarEventDetailPage classId={typedClassId} eventId={typedEventId} />
      </RequirePermission>
    );
  },
});
