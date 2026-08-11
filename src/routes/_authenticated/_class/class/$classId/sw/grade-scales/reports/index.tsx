import { createFileRoute } from "@tanstack/react-router";

import { GradeReportsPlaceholderPage } from "@/components/student-work/GradeReportsPlaceholderPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/sw/grade-scales/reports/",
)({
  component: function ClassGradeReportsPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="gradeScales:read">
        <GradeReportsPlaceholderPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
