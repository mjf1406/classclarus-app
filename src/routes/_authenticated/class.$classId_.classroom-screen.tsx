import { createFileRoute } from "@tanstack/react-router";

import { ClassroomScreenPage } from "@/components/classroomScreen/ClassroomScreenPage";
import { ClassPermissionsProvider } from "@/components/permissions/ClassPermissionsProvider";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import { classPermissionsQueryOptions } from "@/hooks/permissions/useClassPermissions";
import {
  classroomDisplayBundleQueryOptions,
  classroomMinuteBucket,
} from "@/hooks/classroomScreen/useClassroomScreenQueries";
import { awaitPreloadQuery } from "@/lib/routing/routePreload";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/class/$classId_/classroom-screen")({
  loader: async ({ context, params }) => {
    if (!context.auth.isAuthenticated) return;
    const classId = params.classId as Id<"classes">;
    const nowMinuteBucket = classroomMinuteBucket();
    await Promise.all([
      awaitPreloadQuery(context.queryClient, classPermissionsQueryOptions(classId)),
      awaitPreloadQuery(
        context.queryClient,
        classroomDisplayBundleQueryOptions(classId, nowMinuteBucket),
      ),
    ]);
  },
  component: function ClassroomScreenRoute() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <ClassPermissionsProvider classId={typedClassId}>
        <RequirePermission permission="classroomScreen:read">
          <ClassroomScreenPage classId={typedClassId} />
        </RequirePermission>
      </ClassPermissionsProvider>
    );
  },
});
