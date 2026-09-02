import { createFileRoute } from "@tanstack/react-router";

import { StaffDashboardPage } from "@/components/dashboard/StaffDashboardPage";
import { StudentGuardianDashboardPage } from "@/components/dashboard/StudentGuardianDashboardPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import { Skeleton } from "@/components/ui/skeleton";
import { useCan } from "@/hooks/permissions/useCan";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/")({
  component: function ClassDashboardPage() {
    const { classId: classIdParam } = Route.useParams();
    const classId = classIdParam as Id<"classes">;
    const { role, isPending } = useCan();
    const isLearner = role === "student" || role === "guardian";

    return (
      <RequirePermission permission="class:read">
        {isPending ? (
          <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        ) : isLearner ? (
          <StudentGuardianDashboardPage classId={classId} />
        ) : (
          <StaffDashboardPage classId={classId} />
        )}
      </RequirePermission>
    );
  },
});
