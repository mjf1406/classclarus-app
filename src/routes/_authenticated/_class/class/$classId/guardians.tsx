import { createFileRoute } from "@tanstack/react-router";

import { MembersPage } from "@/components/members/MembersPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/guardians")({
  component: function ClassGuardiansPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="guardians:read">
        <MembersPage classId={typedClassId} role="guardian" titleKey="navGuardians" />
      </RequirePermission>
    );
  },
});
