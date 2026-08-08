import { createFileRoute } from "@tanstack/react-router";

import { ExpectationsPage } from "@/components/expectations/ExpectationsPage";
import { RequirePermission } from "@/components/permissions/RequirePermission";
import type { Id } from "../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/expectations/")({
  component: function ClassExpectationsPage() {
    const { classId } = Route.useParams();
    const typedClassId = classId as Id<"classes">;

    return (
      <RequirePermission permission="expectations:read">
        <ExpectationsPage classId={typedClassId} />
      </RequirePermission>
    );
  },
});
