import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { GradedSubjectFormPage } from "@/components/student-work/GradedSubjectFormPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useGradedSubject } from "@/hooks/gradedSubjects/useGradedSubjects";
import type { Id } from "../../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/sw/graded-subjects/$gradedSubjectId/edit",
)({
  component: function ClassGradedSubjectEditPage() {
    const { classId, gradedSubjectId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;
    const typedSubjectId = gradedSubjectId as Id<"gradedSubjects">;
    const { t } = useTranslation("studentWork");
    const { data, isPending, isError, refetch } = useGradedSubject(typedClassId, typedSubjectId);

    if (isPending) {
      return (
        <RequirePermission permission="gradeScales:manage">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 sm:px-8">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full" />
          </div>
        </RequirePermission>
      );
    }

    if (isError || !data) {
      return (
        <RequirePermission permission="gradeScales:manage">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 sm:px-8">
            <ErrorState
              title={isError ? t("subjectsLoadFailed") : t("subjectNotFoundTitle")}
              description={
                isError ? t("subjectsLoadFailedDescription") : t("subjectNotFoundDescription")
              }
              onRetry={isError ? () => void refetch() : undefined}
            />
          </div>
        </RequirePermission>
      );
    }

    return (
      <RequirePermission permission="gradeScales:manage">
        <GradedSubjectFormPage classId={typedClassId} mode="edit" initial={data} />
      </RequirePermission>
    );
  },
});
