import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/sw/grade-scales/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/class/$classId/sw/grade-scales/scales",
      params: { classId: params.classId },
    });
  },
});
