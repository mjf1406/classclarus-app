import { createFileRoute } from "@tanstack/react-router";

import { InvitationsPage } from "@/components/invitations/InvitationsPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import { useClass } from "@/hooks/classes/useClass";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/invitations")({
  component: function ClassInvitationsPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;
    const { data: classDoc } = useClass(typedClassId);
    const classArchived = classDoc?.archivedAt !== undefined;

    return (
      <RequirePermission permission="invitations:read">
        <InvitationsPage classId={typedClassId} classArchived={classArchived} />
      </RequirePermission>
    );
  },
});
