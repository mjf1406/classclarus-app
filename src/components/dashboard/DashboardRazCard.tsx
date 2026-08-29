import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { DashboardSectionCard } from "@/components/dashboard/DashboardSectionCard";
import { RazSummaryContent } from "@/components/raz/RazSummaryContent";
import { useRazForAudience } from "@/hooks/raz/useRazForAudience";
import type { Id } from "../../../convex/_generated/dataModel";

type DashboardRazCardProps = {
  classId: Id<"classes">;
  studentUserId: Id<"users"> | null;
  audiencePending: boolean;
};

export function DashboardRazCard({
  classId,
  studentUserId,
  audiencePending,
}: DashboardRazCardProps) {
  const { t, i18n } = useTranslation("classes");
  const query = useRazForAudience(classId);
  const student = useMemo(
    () => (query.data ?? []).find((row) => row.userId === studentUserId) ?? null,
    [query.data, studentUserId],
  );
  const isPending = audiencePending || query.isPending;
  const empty = !isPending && !query.isError && !student;

  return (
    <DashboardSectionCard
      title={t("dashboardRazTitle")}
      viewAllLabel={t("dashboardViewAll")}
      viewAllTo="/class/$classId/raz"
      viewAllParams={{ classId }}
      isPending={isPending}
      isError={query.isError}
      errorTitle={t("dashboardLoadFailed")}
      errorDescription={t("dashboardLoadFailedDescription")}
      onRetry={() => void query.refetch()}
      empty={empty}
      emptyTitle={t("dashboardNoRazTitle")}
      emptyDescription={t("dashboardNoRazDescription")}
    >
      {student ? <RazSummaryContent student={student} language={i18n.language} compact /> : null}
    </DashboardSectionCard>
  );
}
