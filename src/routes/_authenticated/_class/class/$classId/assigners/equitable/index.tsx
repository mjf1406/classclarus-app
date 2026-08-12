import { createFileRoute } from "@tanstack/react-router";

import { EquitableAssignersPage } from "@/components/assigners/equitable/EquitableAssignersPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/assigners/equitable/")({
  component: function ClassEquitableAssignersIndexPage() {
    const { classId } = Route.useParams();
    return (
      <RequirePermission permission="class:read">
        <EquitableAssignersPage classId={classId as Id<"classes">} />
      </RequirePermission>
    );
  },
});
