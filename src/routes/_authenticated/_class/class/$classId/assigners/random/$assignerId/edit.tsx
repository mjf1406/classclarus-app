import { createFileRoute } from "@tanstack/react-router";

import { RandomAssignerFormPage } from "@/components/assigners/random/RandomAssignerFormPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useRandomAssigner } from "@/hooks/assigners/random/useRandomAssigners";
import { useTranslation } from "react-i18next";
import type { Id } from "../../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/assigners/random/$assignerId/edit",
)({
  component: function ClassRandomAssignerEditPage() {
    const { classId, assignerId } = Route.useParams();
    const { t } = useTranslation("assigners");
    const typedClassId = classId as Id<"classes">;
    const typedAssignerId = assignerId as Id<"randomAssigners">;
    const { data, isPending, isError, refetch } = useRandomAssigner(typedClassId, typedAssignerId);

    if (isError) {
      return (
        <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
          <ErrorState
            title={t("randomLoadFailed")}
            description={t("randomLoadFailedDescription")}
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
        <RandomAssignerFormPage classId={typedClassId} mode="edit" initial={data} />
      </RequirePermission>
    );
  },
});
