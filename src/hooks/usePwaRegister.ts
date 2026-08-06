import { useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

import { STORAGE_KEYS } from "@/lib/storageKeys";

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const UPDATE_CHECK_DEBOUNCE_MS = 2000;

function isSessionDismissed(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEYS.pwaUpdateLater) === "1";
  } catch {
    return false;
  }
}

function setSessionDismissed(): void {
  try {
    sessionStorage.setItem(STORAGE_KEYS.pwaUpdateLater, "1");
  } catch {
    // ignore
  }
}

export type UsePwaRegisterResult = {
  needRefresh: boolean;
  dismiss: () => void;
  reload: () => void;
};

/**
 * Registers the service worker (prompt mode) and exposes update UI state.
 * Only mount this hook outside Electron — use PwaRoot to enforce that.
 */
export function usePwaRegister(): UsePwaRegisterResult {
  const [sessionHidden, setSessionHidden] = useState(isSessionDismissed);
  const updateCheckCleanupRef = useRef<(() => void) | null>(null);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(swUrl, registration) {
      updateCheckCleanupRef.current?.();
      updateCheckCleanupRef.current = null;

      if (!registration) {
        return;
      }

      let debounceId: number | undefined;

      const check = async () => {
        if (registration.installing || !navigator.onLine) {
          return;
        }
        try {
          const resp = await fetch(swUrl, {
            cache: "no-store",
            headers: {
              cache: "no-store",
              "cache-control": "no-cache",
            },
          });
          if (resp.status === 200) {
            await registration.update();
          }
        } catch {
          // offline / flaky — try again later
        }
      };

      const schedule = () => {
        window.clearTimeout(debounceId);
        debounceId = window.setTimeout(() => {
          void check();
        }, UPDATE_CHECK_DEBOUNCE_MS);
      };

      const intervalId = window.setInterval(() => {
        void check();
      }, UPDATE_CHECK_INTERVAL_MS);

      const onVisibility = () => {
        if (document.visibilityState === "visible") {
          schedule();
        }
      };

      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("focus", schedule);

      updateCheckCleanupRef.current = () => {
        window.clearInterval(intervalId);
        window.clearTimeout(debounceId);
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("focus", schedule);
      };
    },
  });

  useEffect(() => {
    return () => {
      updateCheckCleanupRef.current?.();
      updateCheckCleanupRef.current = null;
    };
  }, []);

  // No offlineReady UI — clear quietly when the SW reports ready.
  useEffect(() => {
    if (offlineReady) {
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady]);

  return {
    needRefresh: needRefresh && !sessionHidden,
    dismiss: () => {
      setSessionDismissed();
      setSessionHidden(true);
      setNeedRefresh(false);
    },
    reload: () => {
      void updateServiceWorker(true);
    },
  };
}
