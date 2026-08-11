import { createFileRoute } from "@tanstack/react-router";

import { GradedSubjectFormPage } from "@/components/student-work/GradedSubjectFormPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/sw/graded-subjects/new",
)({
  component: function ClassGradedSubjectCreatePage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="gradeScales:manage">
        <GradedSubjectFormPage classId={typedClassId} mode="create" />
      </RequirePermission>
    );
  },
});
