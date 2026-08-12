import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { EquitableAssignerManualPage } from "@/components/assigners/equitable/EquitableAssignerManualPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../../convex/_generated/dataModel";

const equitableManualSearchSchema = z.object({
  previewRunId: z.string().optional(),
});

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/assigners/equitable/$assignerId/manual",
)({
  validateSearch: equitableManualSearchSchema,
  component: function ClassEquitableAssignerManualRoutePage() {
    const { classId, assignerId } = Route.useParams();
    return (
      <RequirePermission permission="assigners:manage">
        <EquitableAssignerManualPage
          classId={classId as Id<"classes">}
          assignerId={assignerId as Id<"equitableAssigners">}
        />
      </RequirePermission>
    );
  },
});
