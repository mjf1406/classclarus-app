export const LANGUAGE_OPTIONS = [
  { value: "en", label: "English (US)", countryCode: "US", htmlLang: "en-US" },
  { value: "engb", label: "English (UK)", countryCode: "GB", htmlLang: "en-GB" },
  { value: "ja", label: "日本語", countryCode: "JP", htmlLang: "ja" },
  { value: "ko", label: "한국어", countryCode: "KR", htmlLang: "ko" },
  { value: "th", label: "ไทย", countryCode: "TH", htmlLang: "th" },
  { value: "zhs", label: "简体中文", countryCode: "CN", htmlLang: "zh-Hans" },
  { value: "zht", label: "繁體中文", countryCode: "TW", htmlLang: "zh-Hant" },
  { value: "es", label: "Español", countryCode: "ES", htmlLang: "es" },
  { value: "fr", label: "Français", countryCode: "FR", htmlLang: "fr" },
  { value: "it", label: "Italiano", countryCode: "IT", htmlLang: "it" },
  { value: "de", label: "Deutsch", countryCode: "DE", htmlLang: "de" },
  { value: "nl", label: "Nederlands", countryCode: "NL", htmlLang: "nl" },
  { value: "pt", label: "Português", countryCode: "PT", htmlLang: "pt" },
  { value: "ru", label: "Русский", countryCode: "RU", htmlLang: "ru" },
  { value: "uk", label: "Українська", countryCode: "UA", htmlLang: "uk" },
] as const;

export type AppLanguage = (typeof LANGUAGE_OPTIONS)[number]["value"];

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === "string" && LANGUAGE_OPTIONS.some((option) => option.value === value);
}

export function getLanguageOption(language: AppLanguage) {
  return LANGUAGE_OPTIONS.find((option) => option.value === language)!;
}
