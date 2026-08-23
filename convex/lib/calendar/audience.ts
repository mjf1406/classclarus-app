import type { ClassRole } from "../auth/authzModel.js";

/** Roles that can be targeted by calendar events (excludes synthetic `class_member`). */
export const CALENDAR_AUDIENCE_ROLES = [
  "owner",
  "teacher",
  "assistant_teacher",
  "student",
  "guardian",
] as const satisfies ReadonlyArray<ClassRole>;

export type CalendarAudienceRole = (typeof CALENDAR_AUDIENCE_ROLES)[number];

const AUDIENCE_ROLE_SET = new Set<string>(CALENDAR_AUDIENCE_ROLES);

export function isCalendarAudienceRole(value: string): value is CalendarAudienceRole {
  return AUDIENCE_ROLE_SET.has(value);
}

export function uniqueAudienceRoles(roles: ReadonlyArray<string>): Array<CalendarAudienceRole> {
  const seen = new Set<CalendarAudienceRole>();
  for (const role of roles) {
    if (!isCalendarAudienceRole(role)) {
      throw new Error("Invalid audience role");
    }
    seen.add(role);
  }
  return CALENDAR_AUDIENCE_ROLES.filter((role) => seen.has(role));
}

export function eventVisibleToRole(
  audienceKind: "all" | "roles",
  audienceRoles: ReadonlyArray<string>,
  viewerRole: ClassRole | null,
): boolean {
  if (!viewerRole || viewerRole === "class_member") {
    return audienceKind === "all";
  }
  if (audienceKind === "all") {
    return true;
  }
  return audienceRoles.includes(viewerRole);
}

export function assertReminderRolesSubset(
  audienceKind: "all" | "roles",
  audienceRoles: ReadonlyArray<string>,
  notifyRoles: ReadonlyArray<string>,
): Array<CalendarAudienceRole> {
  const unique = uniqueAudienceRoles(notifyRoles);
  if (audienceKind === "all") {
    return unique;
  }
  const allowed = new Set(audienceRoles);
  for (const role of unique) {
    if (!allowed.has(role)) {
      throw new Error("Reminder roles must be a subset of the event audience");
    }
  }
  return unique;
}
