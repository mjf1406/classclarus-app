import { useTranslation } from "react-i18next";

import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_CONFIG } from "@/config/app";
import { useSelfHostUpdateAvailable } from "@/hooks/useSelfHostUpdateAvailable";
import { isElectronClassroom } from "@/lib/classroom/classroomSession";
import { isSelfHosted } from "@/lib/selfHosted";
import { getSelfHostAppVersion, selfHostUpgradeDocsUrl } from "@/lib/selfHostUpdate";
import { cn } from "@/lib/utils";

/** Shows the baked-in app version for Docker/web self-host (not Electron). */
export function SelfHostVersionCard() {
  const { t } = useTranslation("settings");
  const version = getSelfHostAppVersion();
  const { availableVersion, checked } = useSelfHostUpdateAvailable();

  if (!isSelfHosted() || isElectronClassroom() || !version) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("selfHostVersionLabel")}</CardTitle>
        <CardDescription>{t("selfHostVersionDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t("updateCurrentVersion", { version })}</p>
        {checked ? (
          <p className="text-sm">
            {availableVersion
              ? t("selfHostVersionUpdateAvailable", { version: availableVersion })
              : t("selfHostVersionUpToDate")}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <a
            href={APP_CONFIG.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            {t("selfHostUpdateReleaseNotes")}
          </a>
          <a
            href={selfHostUpgradeDocsUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            {t("selfHostUpdateAction")}
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
