import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

const equitableHistorySearchSchema = z.object({
  previewRunId: z.string().optional(),
});

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/assigners/equitable/$assignerId/",
)({
  validateSearch: equitableHistorySearchSchema,
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/class/$classId/assigners/equitable/$assignerId/dashboard",
      params: { classId: params.classId, assignerId: params.assignerId },
      search,
    });
  },
});
