import { createFileRoute } from "@tanstack/react-router";

import { AssignersSeatsIndexRedirect } from "@/components/assigners/AssignersSeatsIndexRedirect";
import type { Id } from "../../../../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/assigners/seats/")({
  component: function ClassAssignersSeatsIndexPage() {
    const { classId } = Route.useParams();
    return <AssignersSeatsIndexRedirect classId={classId as Id<"classes">} />;
  },
});
