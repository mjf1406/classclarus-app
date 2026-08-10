import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Id } from "../../../convex/_generated/dataModel";

export type AssignersSeatsTab = "layouts" | "constraints";

type AssignersSeatsTabsProps = {
  classId: Id<"classes">;
  value: AssignersSeatsTab;
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
          to:
            tab === "constraints"
              ? "/class/$classId/assigners/seats/constraints"
              : "/class/$classId/assigners/seats/layouts",
          params: { classId },
        });
      }}
    >
      <TabsList variant="line" className="w-full sm:w-auto">
        <TabsTrigger value="layouts">{t("tabLayouts")}</TabsTrigger>
        <TabsTrigger value="constraints">{t("tabConstraints")}</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
