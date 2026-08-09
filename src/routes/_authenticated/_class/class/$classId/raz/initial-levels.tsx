import { createFileRoute } from "@tanstack/react-router";

import { RequirePermission } from "@/components/permissions/RequirePermission";
import { RazInitialLevelsPage } from "@/components/raz/RazInitialLevelsPage";
import type { Id } from "../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/raz/initial-levels")({
  component: function ClassRazInitialLevelsPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="raz:manage">
        <RazInitialLevelsPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
