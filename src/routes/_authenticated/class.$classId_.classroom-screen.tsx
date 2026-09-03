import { createFileRoute } from "@tanstack/react-router";

import { ClassroomScreenPage } from "@/components/classroomScreen/ClassroomScreenPage";
import { ClassStudentLanguageOverride } from "@/components/classes/ClassStudentLanguageOverride";
import { ClassPermissionsProvider } from "@/components/permissions/ClassPermissionsProvider";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import { classDetailQueryOptions } from "@/hooks/classes/useClass";
import { classPermissionsQueryOptions } from "@/hooks/permissions/useClassPermissions";
import {
  classroomDisplayBundleQueryOptions,
  classroomMinuteBucket,
} from "@/hooks/classroomScreen/useClassroomScreenQueries";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { isAppLanguage } from "@/lib/languages";
import { GC_TIME } from "@/lib/queryCache";
import { awaitPreloadQuery } from "@/lib/routing/routePreload";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/class/$classId_/classroom-screen")({
  loader: async ({ context, params }) => {
    if (!context.auth.isAuthenticated) return;
    const classId = params.classId as Id<"classes">;
    const nowMinuteBucket = classroomMinuteBucket();
    await Promise.all([
      awaitPreloadQuery(context.queryClient, classPermissionsQueryOptions(classId)),
      awaitPreloadQuery(context.queryClient, classDetailQueryOptions(classId)),
      awaitPreloadQuery(
        context.queryClient,
        classroomDisplayBundleQueryOptions(classId, nowMinuteBucket),
      ),
    ]);
  },
  component: function ClassroomScreenRoute() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;
    const { data: classDoc } = useAuthedQuery(
      api.classes.get,
      { classId: typedClassId },
      { gcTime: GC_TIME.stable },
    );
    const studentLanguage =
      classDoc && isAppLanguage(classDoc.studentLanguage) ? classDoc.studentLanguage : null;

    return (
      <ClassPermissionsProvider classId={typedClassId}>
        {studentLanguage ? (
          <ClassStudentLanguageOverride studentLanguage={studentLanguage} />
        ) : null}
        <RequirePermission permission="classroomScreen:read">
          <ClassroomScreenPage classId={typedClassId} />
        </RequirePermission>
      </ClassPermissionsProvider>
    );
  },
});
