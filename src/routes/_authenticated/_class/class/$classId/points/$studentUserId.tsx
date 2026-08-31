import { createFileRoute } from "@tanstack/react-router";

import { StudentPointsHistoryPage } from "@/components/points/StudentPointsHistoryPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import { classPermissionsQueryOptions } from "@/hooks/permissions/useClassPermissions";
import { pointsBoardQueryOptions } from "@/hooks/points/usePointsBoard";
import { awaitPreloadQuery, preloadQuery } from "@/lib/routing/routePreload";
import type { Id } from "../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/points/$studentUserId")(
  {
    loader: async ({ context, params }) => {
      if (!context.auth.isAuthenticated) {
        return;
      }
      const classId = params.classId as Id<"classes">;
      await awaitPreloadQuery(context.queryClient, classPermissionsQueryOptions(classId));
      preloadQuery(context.queryClient, pointsBoardQueryOptions(classId));
    },
    component: function ClassStudentPointsHistoryPage() {
      const { classId, studentUserId } = Route.useParams();
      const typedClassId = classId as Id<"classes">;
      const typedStudentUserId = studentUserId as Id<"users">;

      return (
        <RequirePermission permission="points:manage">
          <StudentPointsHistoryPage classId={typedClassId} studentUserId={typedStudentUserId} />
        </RequirePermission>
      );
    },
  },
);
