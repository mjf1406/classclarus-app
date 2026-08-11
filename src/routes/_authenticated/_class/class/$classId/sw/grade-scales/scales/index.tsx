import { createFileRoute } from "@tanstack/react-router";

import { GradeScalesPage } from "@/components/student-work/GradeScalesPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/sw/grade-scales/scales/",
)({
  component: function ClassGradeScalesPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="gradeScales:read">
        <GradeScalesPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
