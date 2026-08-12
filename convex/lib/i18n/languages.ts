import { v } from "convex/values";

/** Supported UI / userSettings language codes (keep in sync with src/lib/languages.ts). */
export const LANGUAGE_CODES = [
  "en",
  "engb",
  "ja",
  "ko",
  "th",
  "zhs",
  "zht",
  "es",
  "fr",
  "it",
  "de",
  "nl",
  "pt",
  "ru",
  "uk",
] as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === "string" && (LANGUAGE_CODES as readonly string[]).includes(value);
}

export const languageValidator = v.union(
  v.literal("en"),
  v.literal("engb"),
  v.literal("ja"),
  v.literal("ko"),
  v.literal("th"),
  v.literal("zhs"),
  v.literal("zht"),
  v.literal("es"),
  v.literal("fr"),
  v.literal("it"),
  v.literal("de"),
  v.literal("nl"),
  v.literal("pt"),
  v.literal("ru"),
  v.literal("uk"),
);
