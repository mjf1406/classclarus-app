import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/sw/grade-scales/subjects/",
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/class/$classId/sw/graded-subjects",
      params: { classId: params.classId },
    });
  },
});
