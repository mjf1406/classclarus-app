import { createFileRoute } from "@tanstack/react-router";

import { GradedSubjectsPage } from "@/components/student-work/GradedSubjectsPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/sw/graded-subjects/")({
  component: function ClassGradedSubjectsIndexPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="gradeScales:read">
        <GradedSubjectsPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
