import { createFileRoute } from "@tanstack/react-router";

import { GroupsPage } from "@/components/groups/GroupsPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/groups")({
  component: function ClassGroupsPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="class:read">
        <GroupsPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
