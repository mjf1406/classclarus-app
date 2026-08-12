import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { AssignersSeatsConstraintsPage } from "@/components/assigners/AssignersSeatsConstraintsPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../../../convex/_generated/dataModel";

const constraintsSearchSchema = z.object({
  focusConstraintId: z.string().optional(),
});

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/assigners/seats/constraints/",
)({
  validateSearch: constraintsSearchSchema,
  component: function ClassAssignersSeatsConstraintsPage() {
    const { classId } = Route.useParams();
    const { focusConstraintId } = Route.useSearch();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="students:read">
        <AssignersSeatsConstraintsPage
          classId={typedClassId}
          focusConstraintId={focusConstraintId as Id<"seatConstraints"> | undefined}
        />
      </RequirePermission>
    );
  },
});
