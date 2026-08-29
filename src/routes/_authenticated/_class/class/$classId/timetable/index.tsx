import { createFileRoute } from "@tanstack/react-router";

import { TimetablePage } from "@/components/timetable/TimetablePage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import { preloadTimetableRouteData } from "@/hooks/timetable/useTimetableQueries";
import { timetableSearchSchema } from "@/lib/timetable/timetableSearch";
import type { Id } from "../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/timetable/")({
  validateSearch: timetableSearchSchema,
  loaderDeps: ({ search }) => ({ view: search.view, date: search.date }),
  loader: ({ context, params, deps }) => {
    if (!context.auth.isAuthenticated) {
      return;
    }
    const classId = params.classId as Id<"classes">;
    void preloadTimetableRouteData(context.queryClient, classId, deps).catch(() => {});
  },
  component: function ClassTimetablePage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="timetable:read">
        <TimetablePage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
