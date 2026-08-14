import { useTranslation } from "react-i18next";

import { GradeScalesShell } from "@/components/student-work/GradeScalesShell";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import type { Id } from "../../../convex/_generated/dataModel";

type GradedSubjectsPlaceholderPageProps = {
  classId: Id<"classes">;
};

export function GradedSubjectsPlaceholderPage({ classId }: GradedSubjectsPlaceholderPageProps) {
  const { t } = useTranslation("studentWork");

  return (
    <GradeScalesShell
      classId={classId}
      tab="subjects"
      description={t("subjectsPlaceholderDescription")}
    >
      <Empty card>
        <EmptyHeader>
          <EmptyTitle>{t("subjectsPlaceholderTitle")}</EmptyTitle>
          <EmptyDescription>{t("subjectsPlaceholderDescription")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </GradeScalesShell>
  );
}
