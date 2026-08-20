import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCan } from "@/hooks/permissions/useCan";
import type { Id } from "../../../../convex/_generated/dataModel";

export type RandomAssignerTab = "dashboard" | "data";

type RandomAssignerTabsProps = {
  classId: Id<"classes">;
  assignerId: Id<"randomAssigners">;
  value: RandomAssignerTab;
};

const TAB_ROUTES: Record<RandomAssignerTab, string> = {
  dashboard: "/class/$classId/assigners/random/$assignerId",
  data: "/class/$classId/assigners/random/$assignerId/data",
};

export function RandomAssignerTabs({ classId, assignerId, value }: RandomAssignerTabsProps) {
  const { t } = useTranslation("assigners");
  const navigate = useNavigate();
  const { can } = useCan();
  const canManage = can("assigners:manage");

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        const tab = next as RandomAssignerTab;
        void navigate({
          to: TAB_ROUTES[tab],
          params: { classId, assignerId },
        });
      }}
    >
      <TabsList variant="line">
        <TabsTrigger value="dashboard">{t("randomTabDashboard")}</TabsTrigger>
        {canManage ? <TabsTrigger value="data">{t("randomTabData")}</TabsTrigger> : null}
      </TabsList>
    </Tabs>
  );
}
