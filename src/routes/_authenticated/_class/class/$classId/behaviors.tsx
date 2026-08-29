import { createFileRoute } from "@tanstack/react-router";

import { BehaviorsPage } from "@/components/behaviors/BehaviorsPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import { behaviorsListQueryOptions } from "@/hooks/behaviors/useBehaviors";
import { preloadQuery } from "@/lib/routing/routePreload";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/behaviors")({
  loader: ({ context, params }) => {
    if (!context.auth.isAuthenticated) {
      return;
    }
    const classId = params.classId as Id<"classes">;
    preloadQuery(context.queryClient, behaviorsListQueryOptions(classId));
  },
  component: function ClassBehaviorsPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="class:read">
        <BehaviorsPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
