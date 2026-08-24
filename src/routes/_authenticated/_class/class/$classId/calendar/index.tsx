import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { CalendarPage } from "@/components/calendar/CalendarPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../convex/_generated/dataModel";

const calendarSearchSchema = z.object({
  event: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/_class/class/$classId/calendar/")({
  validateSearch: calendarSearchSchema,
  beforeLoad: ({ params, search }) => {
    if (!search.event) return;
    throw redirect({
      to: "/class/$classId/calendar/event/$eventId",
      params: { classId: params.classId, eventId: search.event },
    });
  },
  component: function ClassCalendarPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="calendar:read">
        <CalendarPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
