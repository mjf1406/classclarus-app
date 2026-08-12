import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCan } from "@/hooks/permissions/useCan";
import type { Id } from "../../../convex/_generated/dataModel";

export type AssignersSeatsTab = "layouts" | "constraints" | "charts" | "data";

type AssignersSeatsTabsProps = {
  classId: Id<"classes">;
  value: AssignersSeatsTab;
};

const TAB_ROUTES: Record<AssignersSeatsTab, string> = {
  layouts: "/class/$classId/assigners/seats/layouts",
  constraints: "/class/$classId/assigners/seats/constraints",
  charts: "/class/$classId/assigners/seats/charts",
  data: "/class/$classId/assigners/seats/data",
};

export function AssignersSeatsTabs({ classId, value }: AssignersSeatsTabsProps) {
  const { t } = useTranslation("assigners");
  const navigate = useNavigate();
  const { can } = useCan();
  // Constraints are staff-only (assistant_teacher+); students/guardians
  // still see layouts + charts via class:read.
  const isStaff = can("students:read");
  const canManageAssigners = can("assigners:manage");

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
        {isStaff ? <TabsTrigger value="constraints">{t("tabConstraints")}</TabsTrigger> : null}
        <TabsTrigger value="charts">{t("tabCharts")}</TabsTrigger>
        {canManageAssigners ? <TabsTrigger value="data">{t("tabData")}</TabsTrigger> : null}
      </TabsList>
    </Tabs>
  );
}
