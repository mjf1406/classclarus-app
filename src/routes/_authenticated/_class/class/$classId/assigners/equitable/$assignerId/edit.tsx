import { createFileRoute } from "@tanstack/react-router";

import { EquitableAssignerFormPage } from "@/components/assigners/equitable/EquitableAssignerFormPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useEquitableAssigner } from "@/hooks/assigners/equitable/useEquitableAssigners";
import { useTranslation } from "react-i18next";
import type { Id } from "../../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/assigners/equitable/$assignerId/edit",
)({
  component: function ClassEquitableAssignerEditPage() {
    const { classId, assignerId } = Route.useParams();
    const { t } = useTranslation("assigners");
    const typedClassId = classId as Id<"classes">;
    const typedAssignerId = assignerId as Id<"equitableAssigners">;
    const { data, isPending, isError, refetch } = useEquitableAssigner(
      typedClassId,
      typedAssignerId,
    );

    if (isError) {
      return (
        <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
          <ErrorState
            title={t("equitableLoadFailed")}
            description={t("equitableLoadFailedDescription")}
            onRetry={() => void refetch()}
          />
        </div>
      );
    }

    if (isPending || !data) {
      return (
        <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
          <Skeleton className="h-96 w-full max-w-2xl" />
        </div>
      );
    }

    return (
      <RequirePermission permission="assigners:manage">
        <EquitableAssignerFormPage classId={typedClassId} mode="edit" initial={data} />
      </RequirePermission>
    );
  },
});
