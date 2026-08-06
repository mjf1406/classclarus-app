import { useEffect } from "react";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";

import { AdminAppSidebar } from "@/components/navigation/admin-sidebar/AdminSidebar";
import { AdminBreadcrumb } from "@/components/navigation/admin-sidebar/AdminBreadcrumb";
import { AppFooter } from "@/components/navigation/AppFooter";
import { FeedbackNavButton } from "@/components/navigation/FeedbackNavButton";
import PendingComponent from "@/components/loading/PendingComponent";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useIsAppAdmin } from "@/hooks/admin/useIsAppAdmin";
import { useIsFeedbackAdmin } from "@/hooks/feedback/useIsFeedbackAdmin";
import { isSelfHosted } from "@/lib/selfHosted";

export const Route = createFileRoute("/_authenticated/admin")({
  component: function AdminLayout() {
    const navigate = useNavigate();
    const selfHosted = isSelfHosted();
    const selfHostAdmin = useIsAppAdmin();
    const feedbackAdmin = useIsFeedbackAdmin();

    const isAdmin = selfHosted ? selfHostAdmin.isAdmin : feedbackAdmin.isAdmin;
    const isPending = selfHosted
      ? selfHostAdmin.isPending || selfHostAdmin.isAuthLoading
      : feedbackAdmin.isPending || feedbackAdmin.isAuthLoading;

    useEffect(() => {
      if (isPending) return;
      if (!isAdmin) {
        void navigate({ to: "/" });
      }
    }, [isAdmin, isPending, navigate]);

    if (isPending) {
      return <PendingComponent inset />;
    }
    if (!isAdmin) {
      return null;
    }

    return (
      <SidebarProvider>
        <AdminAppSidebar />
        <SidebarInset>
          <div className="flex min-h-svh flex-col">
            <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <SidebarTrigger className="-ml-0.5" />
                <Separator orientation="vertical" className="h-4" />
                <AdminBreadcrumb />
              </div>
              <FeedbackNavButton />
            </header>
            <div className="flex flex-1 flex-col">
              <Outlet />
            </div>
          </div>
          <AppFooter />
        </SidebarInset>
      </SidebarProvider>
    );
  },
});
