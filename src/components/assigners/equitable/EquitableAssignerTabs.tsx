import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCan } from "@/hooks/permissions/useCan";
import type { Id } from "../../../../convex/_generated/dataModel";

export type EquitableAssignerTab = "dashboard" | "data";

type EquitableAssignerTabsProps = {
  classId: Id<"classes">;
  assignerId: Id<"equitableAssigners">;
  value: EquitableAssignerTab;
};

const TAB_ROUTES: Record<EquitableAssignerTab, string> = {
  dashboard: "/class/$classId/assigners/equitable/$assignerId/dashboard",
  data: "/class/$classId/assigners/equitable/$assignerId/data",
};

export function EquitableAssignerTabs({ classId, assignerId, value }: EquitableAssignerTabsProps) {
  const { t } = useTranslation("assigners");
  const navigate = useNavigate();
  const { can } = useCan();
  const canManage = can("assigners:manage");

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        const tab = next as EquitableAssignerTab;
        void navigate({
          to: TAB_ROUTES[tab],
          params: { classId, assignerId },
        });
      }}
    >
      <TabsList variant="line">
        <TabsTrigger value="dashboard">{t("equitableTabDashboard")}</TabsTrigger>
        {canManage ? <TabsTrigger value="data">{t("equitableTabData")}</TabsTrigger> : null}
      </TabsList>
    </Tabs>
  );
}
