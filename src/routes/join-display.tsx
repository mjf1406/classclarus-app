import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { JoinCodeDisplayPage } from "@/components/invitations/JoinCodeDisplayPage";
import { JOIN_CODE_PARAM } from "@/lib/invitations/joinCodes";

const joinDisplaySearchSchema = z.object({
  [JOIN_CODE_PARAM]: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/join-display")({
  validateSearch: joinDisplaySearchSchema,
  component: function JoinDisplayRoute() {
    const { [JOIN_CODE_PARAM]: codeFromSearch } = Route.useSearch();
    return <JoinCodeDisplayPage codeFromSearch={codeFromSearch} />;
  },
});
