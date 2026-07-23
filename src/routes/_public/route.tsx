import { PublicNavbar } from "@/components/public/PublicNavbar";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_public")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div>
      <PublicNavbar />
      <Outlet />
    </div>
  );
}
