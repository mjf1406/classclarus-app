import { createFileRoute, redirect } from "@tanstack/react-router";

import { AdminFeedbackPage } from "@/components/feedback/AdminFeedbackPage";
import { isSelfHosted } from "@/lib/selfHosted";

export const Route = createFileRoute("/_authenticated/admin/feedback")({
  beforeLoad: () => {
    if (isSelfHosted()) {
      throw redirect({ to: "/" });
    }
  },
  component: AdminFeedbackPage,
});
