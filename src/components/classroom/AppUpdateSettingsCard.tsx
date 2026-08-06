import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast-manager";
import { useAppUpdate } from "@/hooks/classroom/useAppUpdate";
import { isElectronClassroom } from "@/lib/classroom/classroomSession";

export function AppUpdateSettingsCard() {
  const { t } = useTranslation("settings");
  const status = useAppUpdate();

  useEffect(() => {
    if (status?.phase !== "error" || !status.errorMessage) {
      return;
    }
    toast.add({
      type: "error",
      title: t("updateError"),
      description: status.errorMessage,
    });
  }, [status?.phase, status?.errorMessage, t]);

  if (!isElectronClassroom() || !status) {
    return null;
  }

  const busy = status.phase === "checking" || status.phase === "downloading";

  let statusText: string;
  switch (status.phase) {
    case "checking":
      statusText = t("updateChecking");
      break;
    case "available":
      statusText = t("updateAvailable", { version: status.availableVersion ?? "" });
      break;
    case "downloading":
      statusText = t("updateDownloading", { percent: status.progress ?? 0 });
      break;
    case "ready":
      statusText = t("updateReady", { version: status.availableVersion ?? "" });
      break;
    case "not-available":
      statusText = t("updateUpToDate");
      break;
    case "error":
      statusText = t("updateError");
      break;
    default:
      statusText = t("updateCurrentVersion", { version: status.currentVersion });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("updateLabel")}</CardTitle>
        <CardDescription>{t("updateDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {t("updateCurrentVersion", { version: status.currentVersion })}
        </p>
        <p className="text-sm">{statusText}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              void window.classroom?.checkForUpdates();
            }}
          >
            {t("updateCheck")}
          </Button>
          {status.phase === "ready" ? (
            <Button
              type="button"
              onClick={() => {
                void window.classroom?.quitAndInstall();
              }}
            >
              {t("updateRestartNow")}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
