import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CopyIcon, WifiIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast-manager";
import { useClassroomSession } from "@/hooks/classroom/useClassroomSession";
import { syncJoinOriginFromClassroom } from "@/lib/invitations/joinCodes";

export function ClassroomServerBanner() {
  const { t } = useTranslation("common");
  const session = useClassroomSession();

  useEffect(() => {
    syncJoinOriginFromClassroom(session);
  }, [session]);

  if (!session) {
    return null;
  }

  const statusLabel =
    session.status === "running"
      ? t("classroomServerRunning")
      : session.status === "deploying"
        ? t("classroomServerDeploying")
        : session.status === "starting"
          ? t("classroomServerStarting")
          : session.status === "error"
            ? t("classroomServerError")
            : t("classroomServerStopped");

  const url = session.lanBaseUrl ?? session.loopbackBaseUrl;

  return (
    <div className="border-b border-border bg-muted/40 px-4 py-2 text-sm">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <WifiIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="font-medium">{statusLabel}</p>
            {session.status === "error" && session.errorMessage ? (
              <p className="text-destructive">{session.errorMessage}</p>
            ) : (
              <p className="truncate text-muted-foreground">
                {session.lanIp ? t("classroomLanUrl", { url }) : t("classroomNoLanIp")}
              </p>
            )}
            {session.trustedLanWarning ? (
              <p className="text-xs text-muted-foreground">{t("classroomTrustedLanWarning")}</p>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0"
          disabled={!url}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              toast.add({ type: "success", title: t("copied") });
            } catch {
              toast.add({
                type: "error",
                title: t("copyFailed"),
                description: t("copyFailedDescription"),
              });
            }
          }}
        >
          <CopyIcon className="size-4" />
          {t("classroomCopyUrl")}
        </Button>
      </div>
    </div>
  );
}
