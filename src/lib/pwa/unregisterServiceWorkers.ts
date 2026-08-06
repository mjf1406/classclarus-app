/** Unregister every service worker and wipe Cache Storage for this origin. */
export async function unregisterServiceWorkersAndCaches(): Promise<void> {
  if (typeof window === "undefined") {
    return;
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
}
