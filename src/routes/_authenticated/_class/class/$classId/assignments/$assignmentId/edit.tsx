import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { AssignmentFormPage } from "@/components/assignments/AssignmentFormPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssignment } from "@/hooks/assignments/useAssignment";
import type { Id } from "../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/assignments/$assignmentId/edit",
)({
  component: function ClassAssignmentEditPage() {
    const { classId, assignmentId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;
    const typedAssignmentId = assignmentId as Id<"assignments">;
    const { t } = useTranslation("assignments");
    const { data, isPending, isError, refetch } = useAssignment(typedClassId, typedAssignmentId);

    if (isPending) {
      return (
        <RequirePermission permission="assignments:manage">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8 sm:px-8">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full" />
          </div>
        </RequirePermission>
      );
    }

    if (isError || !data) {
      return (
        <RequirePermission permission="assignments:manage">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8 sm:px-8">
            <ErrorState
              title={isError ? t("loadFailed") : t("notFoundTitle")}
              description={isError ? t("loadFailedDescription") : t("notFoundDescription")}
              onRetry={isError ? () => void refetch() : undefined}
            />
          </div>
        </RequirePermission>
      );
    }

    return (
      <RequirePermission permission="assignments:manage">
        <AssignmentFormPage classId={typedClassId} mode="edit" initial={data} />
      </RequirePermission>
    );
  },
});
