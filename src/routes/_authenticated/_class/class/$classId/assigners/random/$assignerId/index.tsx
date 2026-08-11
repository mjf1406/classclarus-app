import { createFileRoute } from "@tanstack/react-router";

import { RandomAssignerHistoryPage } from "@/components/assigners/random/RandomAssignerHistoryPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/assigners/random/$assignerId/",
)({
  component: function ClassRandomAssignerHistoryRoutePage() {
    const { classId, assignerId } = Route.useParams();
    return (
      <RequirePermission permission="assigners:read">
        <RandomAssignerHistoryPage
          classId={classId as Id<"classes">}
          assignerId={assignerId as Id<"randomAssigners">}
        />
      </RequirePermission>
    );
  },
});
