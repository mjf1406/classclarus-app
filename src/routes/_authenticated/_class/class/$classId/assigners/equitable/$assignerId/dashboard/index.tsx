import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { EquitableAssignerHistoryPage } from "@/components/assigners/equitable/EquitableAssignerHistoryPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../../../convex/_generated/dataModel";

const equitableDashboardSearchSchema = z.object({
  previewRunId: z.string().optional(),
});

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/assigners/equitable/$assignerId/dashboard/",
)({
  validateSearch: equitableDashboardSearchSchema,
  component: function ClassEquitableAssignerDashboardRoutePage() {
    const { classId, assignerId } = Route.useParams();
    const { previewRunId } = Route.useSearch();
    return (
      <RequirePermission permission="class:read">
        <EquitableAssignerHistoryPage
          classId={classId as Id<"classes">}
          assignerId={assignerId as Id<"equitableAssigners">}
          initialPreviewRunId={previewRunId as Id<"equitableAssignerRuns"> | undefined}
        />
      </RequirePermission>
    );
  },
});
