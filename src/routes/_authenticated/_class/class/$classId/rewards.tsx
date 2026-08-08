import { createFileRoute } from "@tanstack/react-router";

import { RewardsPage } from "@/components/rewards/RewardsPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/rewards")({
  component: function ClassRewardsPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="class:read">
        <RewardsPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
