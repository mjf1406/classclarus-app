import { createFileRoute, Navigate } from "@tanstack/react-router";

import { AssignersSeatsStatsPage } from "@/components/assigners/AssignersSeatsStatsPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import { useCan } from "@/hooks/permissions/useCan";
import type { Id } from "../../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/assigners/seats/stats/",
)({
  component: function ClassAssignersSeatsStatsPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;
    const { can, isPending } = useCan();

    if (!isPending && can("students:read")) {
      return (
        <Navigate
          to="/class/$classId/assigners/seats/layouts"
          params={{ classId: typedClassId }}
          replace
        />
      );
    }

    return (
      <RequirePermission permission="class:read">
        <AssignersSeatsStatsPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
