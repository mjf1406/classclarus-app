import { createFileRoute } from "@tanstack/react-router";

import { RandomAssignerDataPage } from "@/components/assigners/random/RandomAssignerDataPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/assigners/random/$assignerId/data/",
)({
  component: function ClassRandomAssignerDataRoutePage() {
    const { classId, assignerId } = Route.useParams();
    return (
      <RequirePermission permission="assigners:manage">
        <RandomAssignerDataPage
          classId={classId as Id<"classes">}
          assignerId={assignerId as Id<"randomAssigners">}
        />
      </RequirePermission>
    );
  },
});
