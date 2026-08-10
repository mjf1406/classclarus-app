import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_class/class/$classId/assigners/seats/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/class/$classId/assigners/seats/layouts",
      params: { classId: params.classId },
    });
  },
});
