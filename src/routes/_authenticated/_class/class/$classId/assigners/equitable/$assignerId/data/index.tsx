import { createFileRoute } from "@tanstack/react-router";

import { EquitableAssignerDataPage } from "@/components/assigners/equitable/EquitableAssignerDataPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/assigners/equitable/$assignerId/data/",
)({
  component: function ClassEquitableAssignerDataRoutePage() {
    const { classId, assignerId } = Route.useParams();
    return (
      <RequirePermission permission="assigners:manage">
        <EquitableAssignerDataPage
          classId={classId as Id<"classes">}
          assignerId={assignerId as Id<"equitableAssigners">}
        />
      </RequirePermission>
    );
  },
});
