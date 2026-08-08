import { createFileRoute } from "@tanstack/react-router";

import { ExpectationDetailPage } from "@/components/expectations/ExpectationDetailPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/expectations/$expectationId",
)({
  component: function ClassExpectationDetailRoute() {
    const { classId, expectationId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;
    const typedExpectationId = expectationId as Id<"expectations">;

    return (
      <RequirePermission permission="expectations:read">
        <ExpectationDetailPage classId={typedClassId} expectationId={typedExpectationId} />
      </RequirePermission>
    );
  },
});
