import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAppUpdate } from "@/hooks/classroom/useAppUpdate";

export function AppUpdateReadyDialog() {
  const { t } = useTranslation("settings");
  const status = useAppUpdate();
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  const readyVersion =
    status?.phase === "ready" && status.availableVersion ? status.availableVersion : null;
  const open = Boolean(readyVersion) && dismissedVersion !== readyVersion;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && readyVersion) {
          setDismissedVersion(readyVersion);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("updateRestartTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("updateRestartDescription", { version: readyVersion ?? "" })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("updateRestartLater")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              void window.classroom?.quitAndInstall();
            }}
          >
            {t("updateRestartNow")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
