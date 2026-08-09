import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { RequirePermission } from "@/components/permissions/RequirePermission";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/")({
  component: function ClassDashboardPage() {
    const { t } = useTranslation("classes");

    return (
      <RequirePermission permission="class:read">
        <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("navDashboard")}
            </h1>
            <p className="hidden text-muted-foreground sm:block">{t("comingSoon")}</p>
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
