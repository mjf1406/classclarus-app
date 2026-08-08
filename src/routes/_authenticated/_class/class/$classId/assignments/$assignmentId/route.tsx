import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_authenticated/_class/class/$classId/assignments/$assignmentId",
)({
  component: function AssignmentIdLayout() {
    return <Outlet />;
  },
});
