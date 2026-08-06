const RECOVERY_KEY = "vctr-pwa-stale-recovery-at";
const RECOVERY_COOLDOWN_MS = 30_000;

/**
 * Unregister service workers, clear Cache Storage, and reload once.
 * Throttled so a broken deploy cannot reload-storm.
 */
export async function recoverFromStaleAssets(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const last = sessionStorage.getItem(RECOVERY_KEY);
    const lastAt = last ? Number(last) : 0;
    if (Number.isFinite(lastAt) && Date.now() - lastAt < RECOVERY_COOLDOWN_MS) {
      return false;
    }
    sessionStorage.setItem(RECOVERY_KEY, String(Date.now()));
  } catch {
    // Private mode / blocked storage — still attempt recovery.
  }

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch {
    // ignore
  }

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // ignore
  }

  window.location.reload();
  return true;
}

/** Wire Vite's lazy-chunk preload failure to stale-asset recovery. */
export function installVitePreloadRecovery(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    void recoverFromStaleAssets();
  });
}
