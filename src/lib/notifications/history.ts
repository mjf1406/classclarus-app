export const HISTORY_PAGE_SIZE = 20;
export const HISTORY_PAGE_SIZE_MAX = 50;

export const NOTIFICATION_DATE_PRESETS = ["all", "7d", "30d", "90d"] as const;
export type NotificationDatePreset = (typeof NOTIFICATION_DATE_PRESETS)[number];

export const NOTIFICATION_STATUS_FILTERS = ["all", "unread", "read", "dismissed"] as const;
export type NotificationStatusFilter = (typeof NOTIFICATION_STATUS_FILTERS)[number];

export const NOTIFICATION_KIND_FILTERS = ["all", "calendar_reminder"] as const;
export type NotificationKindFilter = (typeof NOTIFICATION_KIND_FILTERS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

export function createdAfterMsForPreset(
  preset: NotificationDatePreset,
  now: number,
): number | undefined {
  if (preset === "all") return undefined;
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  return now - days * DAY_MS;
}

export function kindFilterArg(kind: NotificationKindFilter): string | undefined {
  return kind === "all" ? undefined : kind;
}
