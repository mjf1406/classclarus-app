import { createFileRoute } from "@tanstack/react-router";

import { RandomAssignerFormPage } from "@/components/assigners/random/RandomAssignerFormPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/assigners/random/new")({
  component: function ClassRandomAssignerNewPage() {
    const { classId } = Route.useParams();
    return (
      <RequirePermission permission="assigners:manage">
        <RandomAssignerFormPage classId={classId as Id<"classes">} mode="create" />
      </RequirePermission>
    );
  },
});
