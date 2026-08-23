import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  usePushSubscriptions,
  useSubscribePush,
  useUnsubscribePush,
  useVapidPublicKey,
} from "@/hooks/push/usePush";
import { isElectronClassroom } from "@/lib/classroom/classroomSession";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function isSecureContextForPush(): boolean {
  return typeof window !== "undefined" && window.isSecureContext;
}

export function PushSettingsCard() {
  const { t } = useTranslation("settings");
  const electron = isElectronClassroom();
  const supported = pushSupported();
  const secure = isSecureContextForPush();
  const { data: vapidKey } = useVapidPublicKey();
  const { data: subscriptions } = usePushSubscriptions();
  const subscribe = useSubscribePush();
  const unsubscribe = useUnsubscribePush();
  const [pending, setPending] = useState(false);

  const currentEndpoint = useMemo(() => {
    return subscriptions?.[0]?.endpoint;
  }, [subscriptions]);

  const enabled = Boolean(currentEndpoint);

  let blockedReason: string | null = null;
  if (electron) blockedReason = t("pushElectron");
  else if (!supported) blockedReason = t("pushUnsupported");
  else if (!secure) blockedReason = t("pushInsecure");
  else if (!vapidKey) blockedReason = t("pushNotConfigured");

  const handleToggle = async (checked: boolean) => {
    if (blockedReason || pending) return;
    setPending(true);
    try {
      if (!checked) {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        const endpoint = existing?.endpoint ?? currentEndpoint;
        if (existing) {
          await existing.unsubscribe();
        }
        if (endpoint) {
          await unsubscribe.mutateAsync({ endpoint });
        }
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey!) as BufferSource,
      });
      const json = subscription.toJSON();
      const endpoint = json.endpoint;
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;
      if (!endpoint || !p256dh || !auth) {
        throw new Error("Invalid push subscription");
      }
      await subscribe.mutateAsync({
        endpoint,
        p256dh,
        auth,
        userAgent: navigator.userAgent,
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{t("pushTitle")}</CardTitle>
        <CardDescription>{t("pushDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {blockedReason ? (
          <p className="text-sm text-muted-foreground">{blockedReason}</p>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm">{enabled ? t("pushEnabled") : t("pushEnable")}</p>
            <Switch
              checked={enabled}
              disabled={pending || subscribe.isPending || unsubscribe.isPending}
              onCheckedChange={(checked) => {
                void handleToggle(checked);
              }}
            />
          </div>
        )}
        {blockedReason ? null : enabled ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            disabled={pending}
            onClick={() => void handleToggle(false)}
          >
            {t("pushDisable")}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
