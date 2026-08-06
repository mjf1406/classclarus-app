import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { toast } from "@/components/ui/toast-manager";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";

export function ConnectionStatus() {
  const { t } = useTranslation("common");
  const { status, restoredNonce } = useConnectionStatus();

  useEffect(() => {
    if (restoredNonce > 0) {
      toast.add({ type: "info", title: t("connectionRestored") });
    }
  }, [restoredNonce, t]);

  // Hide during the debounce window.
  if (status === "connected" || status === "reconnecting") {
    return null;
  }

  const variant = status === "offline" ? "destructive" : "outline";
  const label = status === "offline" ? t("connectionLost") : t("connectionReconnecting");

  return (
    <Badge variant={variant} className="gap-1.5 px-3">
      <Spinner className={status === "offline" ? "animate-none" : undefined} />
      <span>{label}</span>
    </Badge>
  );
}
