import { createFileRoute } from "@tanstack/react-router";

import { AssignersSeatsDataPage } from "@/components/assigners/AssignersSeatsDataPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/assigners/seats/data/")(
  {
    component: function ClassAssignersSeatsDataPage() {
      const { classId } = Route.useParams();
      const typedClassId = classId as Id<"classes">;

      return (
        <RequirePermission permission="assigners:manage">
          <AssignersSeatsDataPage classId={typedClassId} />
        </RequirePermission>
      );
    },
  },
);
