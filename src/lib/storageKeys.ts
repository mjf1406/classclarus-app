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
  /** localStorage: classes home grid/list view. */
  classesViewMode: appStorageKey("classes-view-mode"),
  /** localStorage: points apply catalog list/grid view. */
  pointsCatalogView: appStorageKey("points-catalog-view"),
  /** localStorage: class/admin sidebar expanded vs collapsed. */
  sidebarOpen: appStorageKey("sidebar-open"),
  /** localStorage: timetable subjects sidebar open vs closed. */
  timetableSubjectsSidebar: appStorageKey("timetable-subjects-sidebar"),
} as const;

/** Shared language preference across classclarus.com subdomains (localStorage is origin-scoped). */
export const LANGUAGE_PREFERENCE = {
  parentDomain: ".classclarus.com",
  maxAgeSeconds: 60 * 60 * 24 * 365,
} as const;

/** localStorage: per-class expectations grid/table view. */
export function expectationsViewModeStorageKey(classId: string): string {
  return appStorageKey(`expectations-view-mode:${classId}`);
}

/** localStorage: per-class group/team filter selection. */
export function groupTeamFiltersStorageKey(classId: string): string {
  return appStorageKey(`group-team-filters:${classId}`);
}

/** localStorage: per-class consumer roster table column visibility (e.g. tasks). */
export function rosterConsumerVisibilityStorageKey(classId: string, surface: string): string {
  return appStorageKey(`roster-col-vis:${surface}:${classId}`);
}
