import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useEntitlement } from "@/hooks/billing/useEntitlement";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { cn } from "@/lib/utils";

const SESSION_DISMISS_KEY = STORAGE_KEYS.trialBannerDismissed;

function wasDismissedThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function dismissForSession(): void {
  try {
    sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
  } catch {
    // ignore
  }
}

/** Escalating upgrade banner for the last 14 days of the card-less trial. */
export function TrialBanner() {
  const { t } = useTranslation("billing");
  const { entitlement } = useEntitlement();
  const [dismissed, setDismissed] = useState(wasDismissedThisSession);

  if (!entitlement?.showWarningBanner || entitlement.daysRemaining === null) {
    return null;
  }

  if (dismissed && !entitlement.forceBanner) {
    return null;
  }

  const days = entitlement.daysRemaining;

  return (
    <div className="border-b bg-background px-4 py-3">
      <Alert className="mx-auto max-w-4xl" variant="destructive">
        <AlertTitle>{t("bannerTitle")}</AlertTitle>
        <AlertDescription>{t("bannerBody", { count: days })}</AlertDescription>
        <AlertAction className="flex items-center gap-2">
          <Link to="/billing" className={cn(buttonVariants({ size: "sm" }))}>
            {t("bannerCta")}
          </Link>
          {!entitlement.forceBanner ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("bannerDismiss")}
              onClick={() => {
                dismissForSession();
                setDismissed(true);
              }}
            >
              <X />
            </Button>
          ) : null}
        </AlertAction>
      </Alert>
    </div>
  );
}
