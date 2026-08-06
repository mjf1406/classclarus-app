import { createFileRoute } from "@tanstack/react-router";

import { MembersPage } from "@/components/members/MembersPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/teachers")({
  component: function ClassTeachersPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="teachers:read">
        <MembersPage classId={typedClassId} role="teacher" titleKey="navTeachers" />
      </RequirePermission>
    );
  },
});
