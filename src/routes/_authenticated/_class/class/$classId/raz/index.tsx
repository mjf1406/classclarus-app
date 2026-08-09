import { createFileRoute } from "@tanstack/react-router";

import { RequirePermission } from "@/components/permissions/RequirePermission";
import { RazPage } from "@/components/raz/RazPage";
import type { Id } from "../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/raz/")({
  component: function ClassRazPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="raz:read">
        <RazPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
