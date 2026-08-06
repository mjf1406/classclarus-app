import { Link } from "@tanstack/react-router";
import { useConvexAuth } from "@convex-dev/auth/react";
import { MessageSquareIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isSelfHosted } from "@/lib/selfHosted";

type FeedbackNavButtonProps = {
  className?: string;
};

/** Cloud-only shortcut to the feedback form. Hidden when logged out or self-hosted. */
export function FeedbackNavButton({ className }: FeedbackNavButtonProps) {
  const { t } = useTranslation("common");
  const { isAuthenticated } = useConvexAuth();
  const label = t("feedback");

  if (!isAuthenticated || isSelfHosted()) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      nativeButton={false}
      aria-label={label}
      className={cn(
        "max-md:size-8 max-md:gap-0 max-md:px-0 max-md:has-data-[icon=inline-start]:pl-0",
        className,
      )}
      render={<Link to="/feedback" />}
    >
      <MessageSquareIcon data-icon="inline-start" />
      <span className="hidden md:inline">{label}</span>
    </Button>
  );
}
