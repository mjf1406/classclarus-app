import { createFileRoute } from "@tanstack/react-router";

import { ActivityLogPage } from "@/components/activity/ActivityLogPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import { classActivityRecentQueryOptions } from "@/hooks/activity/useClassActivity";
import { preloadQuery } from "@/lib/routing/routePreload";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/activity")({
  loader: ({ context, params }) => {
    if (!context.auth.isAuthenticated) {
      return;
    }
    const classId = params.classId as Id<"classes">;
    preloadQuery(context.queryClient, classActivityRecentQueryOptions(classId));
  },
  component: function ClassActivityPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="activity:read">
        <ActivityLogPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
