import { createFileRoute } from "@tanstack/react-router";

import { GradedSubjectsPlaceholderPage } from "@/components/student-work/GradedSubjectsPlaceholderPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/sw/grade-scales/subjects/",
)({
  component: function ClassGradedSubjectsPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="gradeScales:read">
        <GradedSubjectsPlaceholderPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
