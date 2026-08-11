import { createFileRoute } from "@tanstack/react-router";

import { RandomAssignersPage } from "@/components/assigners/random/RandomAssignersPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/assigners/random/")({
  component: function ClassRandomAssignersIndexPage() {
    const { classId } = Route.useParams();
    return (
      <RequirePermission permission="assigners:read">
        <RandomAssignersPage classId={classId as Id<"classes">} />
      </RequirePermission>
    );
  },
});
