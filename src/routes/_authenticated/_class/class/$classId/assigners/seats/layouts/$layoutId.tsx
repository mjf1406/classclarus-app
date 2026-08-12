import { createFileRoute } from "@tanstack/react-router";

import { SeatLayoutEditorPage } from "@/components/assigners/SeatLayoutEditorPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/assigners/seats/layouts/$layoutId",
)({
  component: function ClassSeatLayoutEditorRoute() {
    const { classId, layoutId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;
    const typedLayoutId = layoutId as Id<"seatLayouts">;

    return (
      <RequirePermission permission="class:read">
        <SeatLayoutEditorPage classId={typedClassId} layoutId={typedLayoutId} />
      </RequirePermission>
    );
  },
});
