import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCan } from "@/hooks/permissions/useCan";
import type { Id } from "../../../convex/_generated/dataModel";

export type GradeScalesTab = "scales" | "subjects" | "reports";

type GradeScalesTabsProps = {
  classId: Id<"classes">;
  value: GradeScalesTab;
};

const TAB_ROUTES: Record<GradeScalesTab, string> = {
  scales: "/class/$classId/sw/grade-scales/scales",
  subjects: "/class/$classId/sw/graded-subjects",
  reports: "/class/$classId/sw/grade-scales/reports",
};

export function GradeScalesTabs({ classId, value }: GradeScalesTabsProps) {
  const { t } = useTranslation("studentWork");
  const navigate = useNavigate();
  const { can } = useCan();
  const canReadScales = can("gradeScales:read");

  // Students/guardians see graded subjects via class:read but not scales/reports.
  if (!canReadScales) {
    return null;
  }

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        const tab = next as GradeScalesTab;
        void navigate({
          to: TAB_ROUTES[tab],
          params: { classId },
        });
      }}
    >
      <TabsList variant="line">
        <TabsTrigger value="scales">{t("tabGradeScales")}</TabsTrigger>
        <TabsTrigger value="subjects">{t("tabGradedSubjects")}</TabsTrigger>
        <TabsTrigger value="reports">{t("tabReports")}</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
