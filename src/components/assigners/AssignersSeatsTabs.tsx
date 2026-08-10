import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Id } from "../../../convex/_generated/dataModel";

export type AssignersSeatsTab = "layouts" | "constraints" | "charts";

type AssignersSeatsTabsProps = {
  classId: Id<"classes">;
  value: AssignersSeatsTab;
};

const TAB_ROUTES: Record<AssignersSeatsTab, string> = {
  layouts: "/class/$classId/assigners/seats/layouts",
  constraints: "/class/$classId/assigners/seats/constraints",
  charts: "/class/$classId/assigners/seats/charts",
};

export function AssignersSeatsTabs({ classId, value }: AssignersSeatsTabsProps) {
  const { t } = useTranslation("assigners");
  const navigate = useNavigate();

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        const tab = next as AssignersSeatsTab;
        void navigate({
          to: TAB_ROUTES[tab],
          params: { classId },
        });
      }}
    >
      <TabsList variant="line">
        <TabsTrigger value="layouts">{t("tabLayouts")}</TabsTrigger>
        <TabsTrigger value="constraints">{t("tabConstraints")}</TabsTrigger>
        <TabsTrigger value="charts">{t("tabCharts")}</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
