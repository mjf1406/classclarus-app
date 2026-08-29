import { useTranslation } from "react-i18next";

import { DashboardSectionCard } from "@/components/dashboard/DashboardSectionCard";
import { RazSummaryContent, type RazSummaryStudent } from "@/components/raz/RazSummaryContent";
import type { Id } from "../../../convex/_generated/dataModel";

type DashboardRazCardProps = {
  classId: Id<"classes">;
  student: RazSummaryStudent | null;
  language: string;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
};

export function DashboardRazCard({
  classId,
  student,
  language,
  isPending,
  isError,
  onRetry,
}: DashboardRazCardProps) {
  const { t } = useTranslation("classes");
  const empty = !isPending && !isError && !student;

  return (
    <DashboardSectionCard
      title={t("dashboardRazTitle")}
      viewAllLabel={t("dashboardViewAll")}
      viewAllTo="/class/$classId/raz"
      viewAllParams={{ classId }}
      isPending={isPending}
      isError={isError}
      errorTitle={t("dashboardLoadFailed")}
      errorDescription={t("dashboardLoadFailedDescription")}
      onRetry={onRetry}
      empty={empty}
      emptyTitle={t("dashboardNoRazTitle")}
      emptyDescription={t("dashboardNoRazDescription")}
    >
      {student ? <RazSummaryContent student={student} language={language} compact /> : null}
    </DashboardSectionCard>
  );
}
