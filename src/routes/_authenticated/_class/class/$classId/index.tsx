import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { SeedTestStudentsButton } from "@/components/admin/SeedTestStudentsButton";
import { StudentGuardianDashboardPage } from "@/components/dashboard/StudentGuardianDashboardPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import { Skeleton } from "@/components/ui/skeleton";
import { useCan } from "@/hooks/permissions/useCan";
import { useClass } from "@/hooks/classes/useClass";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/")({
  component: function ClassDashboardPage() {
    const { t } = useTranslation("classes");
    const { classId: classIdParam } = Route.useParams();
    const classId = classIdParam as Id<"classes">;
    const { data: classDoc } = useClass(classId);
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
          <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-2">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {t("navDashboard")}
                </h1>
                <p className="hidden text-muted-foreground sm:block">{t("comingSoon")}</p>
              </div>
              {classDoc ? (
                <SeedTestStudentsButton classId={classId} classDisplayName={classDoc.name} />
              ) : null}
            </div>
            <img
              src="/img/under-construction.webp"
              alt={t("comingSoon")}
              className="w-full max-w-xl rounded-xl"
            />
          </div>
        )}
      </RequirePermission>
    );
  },
});
