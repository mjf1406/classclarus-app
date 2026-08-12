import { createFileRoute } from "@tanstack/react-router";

import { EquitableAssignerDisplayPage } from "@/components/assigners/equitable/EquitableAssignerDisplayPage";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/de/$runId")({
  component: function EquitableAssignerDisplayRoute() {
    const { runId } = Route.useParams();
    return <EquitableAssignerDisplayPage runId={runId as Id<"equitableAssignerRuns">} />;
  },
});
