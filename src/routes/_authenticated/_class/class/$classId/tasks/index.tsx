import { createFileRoute } from "@tanstack/react-router";

import { RequirePermission } from "@/components/permissions/RequirePermission";
import { TasksPage } from "@/components/tasks/TasksPage";
import { tasksListQueryOptions } from "@/hooks/tasks/useTasks";
import { preloadQuery } from "@/lib/routing/routePreload";
import type { Id } from "../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/tasks/")({
  loader: ({ context, params }) => {
    if (!context.auth.isAuthenticated) {
      return;
    }
    const classId = params.classId as Id<"classes">;
    preloadQuery(context.queryClient, tasksListQueryOptions(classId));
  },
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
