import i18n from "@/i18n";
import { pickCountdownUnit, pickDueDurationUnit, type DueDurationUnit } from "@/i18n/countdown";
import { dueDateKeyHasTime, parseDueDateKey } from "@/lib/dueDate/dueDateKey";
import { getLanguageOption, isAppLanguage } from "@/lib/languages";

function getAppLocale(): string {
  return isAppLanguage(i18n.language) ? getLanguageOption(i18n.language).htmlLang : i18n.language;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatUnitDuration(value: number, unit: DueDurationUnit): string {
  return new Intl.NumberFormat(getAppLocale(), {
    style: "unit",
    unit,
    unitDisplay: "long",
  }).format(value);
}

/**
 * Relative due label for parentheses, e.g. "22 days", "12 hours", "3 days ago".
 * Date-only keys use calendar-day distance (due today → omit).
 */
export function formatDueRelative(dueDateKey: string, now: Date = new Date()): string | null {
  if (!dueDateKeyHasTime(dueDateKey)) {
    const due = parseDueDateKey(dueDateKey);
    if (!due) return null;
    const dayMs = 24 * 60 * 60 * 1000;
    const dayDiff = Math.round(
      (startOfLocalDay(due).getTime() - startOfLocalDay(now).getTime()) / dayMs,
    );
    if (dayDiff === 0) return null;
    if (dayDiff > 0) return formatUnitDuration(dayDiff, "day");
    return new Intl.RelativeTimeFormat(getAppLocale(), { numeric: "always" }).format(
      dayDiff,
      "day",
    );
  }

  const due = parseDueDateKey(dueDateKey);
  if (!due) return null;
  const deltaMs = due.getTime() - now.getTime();
  const picked = pickDueDurationUnit(deltaMs);
  if (!picked) return null;

  if (deltaMs >= 0) return formatUnitDuration(picked.value, picked.unit);
  return new Intl.RelativeTimeFormat(getAppLocale(), { numeric: "always" }).format(
    -picked.value,
    picked.unit,
  );
}

export function formatLocalizedDateTime(timestampMs: number): string {
  return new Intl.DateTimeFormat(getAppLocale(), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestampMs));
}

/**
 * Localized due date for tasks/assignments, e.g.
 * "Wednesday, August 19, 2026 at 8:20 PM (22 days)"
 * (time omitted when the key is date-only).
 */
export function formatLocalizedDueDate(dueDateKey: string, now: Date = new Date()): string {
  const date = parseDueDateKey(dueDateKey);
  if (!date) return dueDateKey;
  const absolute = new Intl.DateTimeFormat(getAppLocale(), {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(dueDateKeyHasTime(dueDateKey)
      ? { hour: "numeric" as const, minute: "2-digit" as const }
      : {}),
  }).format(date);
  const relative = formatDueRelative(dueDateKey, now);
  return relative ? `${absolute} (${relative})` : absolute;
}

/**
 * Localized relative countdown until `expiresAtMs` (e.g. "in 3 days", "in 22 hours").
 * Picks the largest useful unit: days → hours → minutes → seconds.
 */
export function formatCountdownUntil(expiresAtMs: number, nowMs: number): string {
  const rtf = new Intl.RelativeTimeFormat(getAppLocale(), { numeric: "always" });
  const { value, unit } = pickCountdownUnit(expiresAtMs - nowMs);
  return rtf.format(value, unit);
}
