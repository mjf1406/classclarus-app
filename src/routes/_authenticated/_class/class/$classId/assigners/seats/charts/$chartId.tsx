import { createFileRoute } from "@tanstack/react-router";

import { SeatChartEditorPage } from "@/components/assigners/SeatChartEditorPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/assigners/seats/charts/$chartId",
)({
  component: function ClassAssignersSeatChartEditorPage() {
    const { classId, chartId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;
    const typedChartId = chartId as Id<"seatCharts">;

    return (
      <RequirePermission permission="class:read">
        <SeatChartEditorPage classId={typedClassId} chartId={typedChartId} />
      </RequirePermission>
    );
  },
});
