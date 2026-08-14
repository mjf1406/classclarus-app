import { useTranslation } from "react-i18next";

import { GradeScalesShell } from "@/components/student-work/GradeScalesShell";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import type { Id } from "../../../convex/_generated/dataModel";

type GradeReportsPlaceholderPageProps = {
  classId: Id<"classes">;
};

export function GradeReportsPlaceholderPage({ classId }: GradeReportsPlaceholderPageProps) {
  const { t } = useTranslation("studentWork");

  return (
    <GradeScalesShell
      classId={classId}
      tab="reports"
      description={t("reportsPlaceholderDescription")}
    >
      <Empty card>
        <EmptyHeader>
          <EmptyTitle>{t("reportsPlaceholderTitle")}</EmptyTitle>
          <EmptyDescription>{t("reportsPlaceholderDescription")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </GradeScalesShell>
  );
}
