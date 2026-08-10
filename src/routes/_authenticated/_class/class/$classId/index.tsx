import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { SeedTestStudentsButton } from "@/components/admin/SeedTestStudentsButton";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import { useClass } from "@/hooks/classes/useClass";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/")({
  component: function ClassDashboardPage() {
    const { t } = useTranslation("classes");
    const { classId: classIdParam } = Route.useParams();
    const classId = classIdParam as Id<"classes">;
    const { data: classDoc } = useClass(classId);

    return (
      <RequirePermission permission="class:read">
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
      </RequirePermission>
    );
  },
});
