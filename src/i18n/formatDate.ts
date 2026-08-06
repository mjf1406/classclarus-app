import i18n from "@/i18n";
import { pickCountdownUnit } from "@/i18n/countdown";
import { getLanguageOption, isAppLanguage } from "@/lib/languages";

function getAppLocale(): string {
  return isAppLanguage(i18n.language) ? getLanguageOption(i18n.language).htmlLang : i18n.language;
}

export function formatLocalizedDateTime(timestampMs: number): string {
  return new Intl.DateTimeFormat(getAppLocale(), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestampMs));
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
