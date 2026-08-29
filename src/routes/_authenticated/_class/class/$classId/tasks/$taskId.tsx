import { createFileRoute } from "@tanstack/react-router";

import { RequirePermission } from "@/components/permissions/RequirePermission";
import { TaskDetailPage } from "@/components/tasks/TaskDetailPage";
import { taskDetailQueryOptions } from "@/hooks/tasks/useTask";
import { preloadQuery } from "@/lib/routing/routePreload";
import type { Id } from "../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/tasks/$taskId")({
  loader: ({ context, params }) => {
    if (!context.auth.isAuthenticated) {
      return;
    }
    const classId = params.classId as Id<"classes">;
    const taskId = params.taskId as Id<"tasks">;
    preloadQuery(context.queryClient, taskDetailQueryOptions(classId, taskId));
  },
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
