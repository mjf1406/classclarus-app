import { createFileRoute } from "@tanstack/react-router";

import { MembersPage } from "@/components/members/MembersPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/students")({
  component: function ClassStudentsPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="students:read">
        <MembersPage classId={typedClassId} role="student" titleKey="navStudents" />
      </RequirePermission>
    );
  },
});
