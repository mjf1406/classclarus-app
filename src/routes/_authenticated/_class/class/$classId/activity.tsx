import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { RequirePermission } from "@/components/permissions/RequirePermission";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/activity")({
  component: function ClassActivityPage() {
    const { t } = useTranslation("classes");

    return (
      <RequirePermission permission="activity:read">
        <div className="flex w-full flex-col gap-2 px-4 py-8 sm:px-8">
          <h1 className="text-2xl font-semibold tracking-tight">{t("navActivityLog")}</h1>
          <p className="text-sm text-muted-foreground">{t("comingSoon")}</p>
        </div>
      </RequirePermission>
    );
  },
});
