import { createFileRoute } from "@tanstack/react-router";

import { BehaviorsPage } from "@/components/behaviors/BehaviorsPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/behaviors")({
  component: function ClassBehaviorsPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="behaviors:manage">
        <BehaviorsPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
