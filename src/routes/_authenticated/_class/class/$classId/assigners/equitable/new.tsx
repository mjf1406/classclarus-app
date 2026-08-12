import { createFileRoute } from "@tanstack/react-router";

import { EquitableAssignerFormPage } from "@/components/assigners/equitable/EquitableAssignerFormPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/assigners/equitable/new",
)({
  component: function ClassEquitableAssignerNewPage() {
    const { classId } = Route.useParams();
    return (
      <RequirePermission permission="assigners:manage">
        <EquitableAssignerFormPage classId={classId as Id<"classes">} mode="create" />
      </RequirePermission>
    );
  },
});
