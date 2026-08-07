import { createFileRoute } from "@tanstack/react-router";

import { RequirePermission } from "@/components/permissions/RequirePermission";
import { TaskDetailPage } from "@/components/tasks/TaskDetailPage";
import type { Id } from "../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/tasks/$taskId")({
  component: function ClassTaskDetailRoute() {
    const { classId, taskId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;
    const typedTaskId = taskId as Id<"tasks">;

    return (
      <RequirePermission permission="class:read">
        <TaskDetailPage classId={typedClassId} taskId={typedTaskId} />
      </RequirePermission>
    );
  },
});
