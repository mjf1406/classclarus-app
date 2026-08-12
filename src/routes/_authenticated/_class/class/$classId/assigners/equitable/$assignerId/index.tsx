import { createFileRoute } from "@tanstack/react-router";

import { EquitableAssignerHistoryPage } from "@/components/assigners/equitable/EquitableAssignerHistoryPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/assigners/equitable/$assignerId/",
)({
  component: function ClassEquitableAssignerHistoryRoutePage() {
    const { classId, assignerId } = Route.useParams();
    return (
      <RequirePermission permission="class:read">
        <EquitableAssignerHistoryPage
          classId={classId as Id<"classes">}
          assignerId={assignerId as Id<"equitableAssigners">}
        />
      </RequirePermission>
    );
  },
});
