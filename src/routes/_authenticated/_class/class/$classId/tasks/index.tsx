import { createFileRoute } from "@tanstack/react-router";

import { RequirePermission } from "@/components/permissions/RequirePermission";
import { TasksPage } from "@/components/tasks/TasksPage";
import type { Id } from "../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/tasks/")({
  component: function ClassTasksPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="class:read">
        <TasksPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
