import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AppFooter } from "@/components/navigation/AppFooter";
import { Navbar } from "@/components/navigation/NavBar";

export const Route = createFileRoute("/_public")({
  component: () => (
    <div>
      <div className="flex min-h-svh flex-col">
        <Navbar />
        <div className="flex flex-1 flex-col">
          <Outlet />
        </div>
      </div>
      <AppFooter />
    </div>
  ),
});
