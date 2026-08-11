import { createFileRoute } from "@tanstack/react-router";

import { RandomAssignerDisplayPage } from "@/components/assigners/random/RandomAssignerDisplayPage";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/d/$runId")({
  component: function RandomAssignerDisplayRoute() {
    const { runId } = Route.useParams();
    return <RandomAssignerDisplayPage runId={runId as Id<"randomAssignerRuns">} />;
  },
});
