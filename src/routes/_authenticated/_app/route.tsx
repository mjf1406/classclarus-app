import { ClassroomServerBanner } from "@/components/classroom/ClassroomServerBanner";
import { SelfHostUpdateBanner } from "@/components/classroom/SelfHostUpdateBanner";
import { Navbar } from "@/components/navigation/NavBar";
import { AppFooter } from "@/components/navigation/AppFooter";
import { TrialBanner } from "@/components/billing/TrialBanner";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_app")({
  component: function AppLayout() {
    return (
      <div>
        <div className="flex min-h-svh flex-col">
          <Navbar />
          <SelfHostUpdateBanner />
          <ClassroomServerBanner />
          <TrialBanner />
          <div className="flex flex-1 flex-col">
            <Outlet />
          </div>
        </div>
        <AppFooter />
      </div>
    );
  },
});
