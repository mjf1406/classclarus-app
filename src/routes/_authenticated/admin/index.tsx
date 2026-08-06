import { createFileRoute, redirect } from "@tanstack/react-router";

import { AdminUsersPage } from "@/components/admin/AdminUsersPage";
import { isSelfHosted } from "@/lib/selfHosted";

export const Route = createFileRoute("/_authenticated/admin/")({
  beforeLoad: () => {
    if (!isSelfHosted()) {
      throw redirect({ to: "/admin/feedback" });
    }
  },
  component: AdminUsersPage,
});
