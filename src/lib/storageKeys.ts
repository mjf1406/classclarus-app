import { APP_CONFIG } from "@/config/app";

/** Browser storage key scoped to the product slug (avoids clashes when multiple apps share an origin). */
export function appStorageKey(suffix: string): string {
  return `${APP_CONFIG.slug}-${suffix}`;
}

export const STORAGE_KEYS = {
  language: appStorageKey("language"),
  theme: appStorageKey("ui-theme"),
  pendingJoinCode: appStorageKey("pendingJoinCode"),
  trialBannerDismissed: appStorageKey("trial-banner-dismissed"),
  selfHostUpdateDismissed: appStorageKey("self-host-update-dismissed"),
  /** sessionStorage: hide banner for this version until the tab session ends. */
  selfHostUpdateRemindLater: appStorageKey("self-host-update-remind-later"),
  /** sessionStorage: hide PWA reload banner until the tab session ends. */
  pwaUpdateLater: appStorageKey("pwa-update-later"),
} as const;
