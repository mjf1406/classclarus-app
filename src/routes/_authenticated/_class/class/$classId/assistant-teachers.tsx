import { createFileRoute } from "@tanstack/react-router";

import { MembersPage } from "@/components/members/MembersPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/assistant-teachers")({
  component: function ClassAssistantTeachersPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="assistantTeachers:read">
        <MembersPage
          classId={typedClassId}
          role="assistant_teacher"
          titleKey="navAssistantTeachers"
        />
      </RequirePermission>
    );
  },
});
