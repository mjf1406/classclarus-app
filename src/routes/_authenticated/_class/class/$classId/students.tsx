import { createFileRoute } from "@tanstack/react-router";

import { RequirePermission } from "@/components/permissions/RequirePermission";
import { StudentsPage } from "@/components/students/StudentsPage";
import { studentRosterQueryOptions } from "@/hooks/roster/useStudentRoster";
import { preloadQuery } from "@/lib/routing/routePreload";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/students")({
  loader: ({ context, params }) => {
    if (!context.auth.isAuthenticated) {
      return;
    }
    const classId = params.classId as Id<"classes">;
    preloadQuery(context.queryClient, studentRosterQueryOptions(classId));
  },
  component: function ClassStudentsPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="students:read">
        <StudentsPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
