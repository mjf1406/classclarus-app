import { createFileRoute, redirect } from "@tanstack/react-router";

import { FeedbackFormPage } from "@/components/feedback/FeedbackFormPage";
import { isSelfHosted } from "@/lib/selfHosted";

export const Route = createFileRoute("/_authenticated/_app/feedback")({
  beforeLoad: () => {
    if (isSelfHosted()) {
      throw redirect({ to: "/" });
    }
  },
  component: FeedbackFormPage,
});
