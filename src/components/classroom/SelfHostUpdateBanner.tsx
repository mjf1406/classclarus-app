import { useState } from "react";
import { LightbulbIcon, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { APP_CONFIG } from "@/config/app";
import {
  dismissSelfHostUpdate,
  remindLaterSelfHostUpdate,
  useSelfHostUpdateAvailable,
} from "@/hooks/useSelfHostUpdateAvailable";
import { selfHostUpgradeDocsUrl } from "@/lib/selfHostUpdate";
import { cn } from "@/lib/utils";

export type SelfHostUpdateBannerViewProps = {
  currentVersion: string;
  availableVersion: string;
  onRemindLater: () => void;
  onDismiss: () => void;
  className?: string;
};

/**
 * Presentational self-host update banner (layout + copy).
 * Used by the live banner and the /ui playground.
 */
export function SelfHostUpdateBannerView({
  currentVersion,
  availableVersion,
  onRemindLater,
  onDismiss,
  className,
}: SelfHostUpdateBannerViewProps) {
  const { t } = useTranslation("settings");

  return (
    <div className={cn("border-b bg-background px-4 py-3", className)}>
      <Alert className="mx-auto max-w-4xl">
        <AlertTitle className="pr-8">{t("selfHostUpdateTitle")}</AlertTitle>
        <AlertDescription>
          <p>
            {t("selfHostUpdateDescription", {
              current: currentVersion,
              version: availableVersion,
            })}
          </p>
          <p
            className={cn(
              "mt-2 flex items-start gap-2 rounded-xl border px-2.5 py-2",
              "border-orange-600 bg-[color-mix(in_oklab,var(--background)_80%,var(--color-orange-500)_20%)]",
              "text-orange-700 dark:border-orange-400 dark:text-orange-400",
            )}
          >
            <LightbulbIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{t("selfHostUpdateTip")}</span>
          </p>
        </AlertDescription>
        <div className="col-start-1 mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <a
              href={selfHostUpgradeDocsUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ size: "sm" }), "w-full justify-center sm:w-auto")}
            >
              {t("selfHostUpdateAction")}
            </a>
            <a
              href={APP_CONFIG.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "w-full justify-center sm:w-auto",
              )}
            >
              {t("selfHostUpdateReleaseNotes")}
            </a>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-center sm:w-auto"
            onClick={onRemindLater}
          >
            {t("selfHostUpdateRemindLater")}
          </Button>
        </div>
        <AlertAction>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("selfHostUpdateDismiss")}
            onClick={onDismiss}
          >
            <X />
          </Button>
        </AlertAction>
      </Alert>
    </div>
  );
}

/** Persistent banner under the navbar when a newer self-host release is available. */
export function SelfHostUpdateBanner() {
  const { currentVersion, availableVersion, showBanner } = useSelfHostUpdateAvailable();
  const [hidden, setHidden] = useState(false);

  if (!showBanner || !availableVersion || !currentVersion || hidden) {
    return null;
  }

  return (
    <SelfHostUpdateBannerView
      currentVersion={currentVersion}
      availableVersion={availableVersion}
      onRemindLater={() => {
        remindLaterSelfHostUpdate(availableVersion);
        setHidden(true);
      }}
      onDismiss={() => {
        dismissSelfHostUpdate(availableVersion);
        setHidden(true);
      }}
    />
  );
}
