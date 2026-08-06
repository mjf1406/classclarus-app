import { describe, expect, test } from "vite-plus/test";

import { LANGUAGE_OPTIONS, type AppLanguage } from "@/lib/languages";

import de from "./resources/de";
import en from "./resources/en";
import es from "./resources/es";
import fr from "./resources/fr";
import it from "./resources/it";
import ja from "./resources/ja";
import ko from "./resources/ko";
import nl from "./resources/nl";
import pt from "./resources/pt";
import ru from "./resources/ru";
import th from "./resources/th";
import uk from "./resources/uk";
import zhs from "./resources/zhs";
import zht from "./resources/zht";
import type { TranslationCatalog } from "./resources/en";

type LocaleResources = {
  [Namespace in keyof TranslationCatalog]?: {
    [Key in keyof TranslationCatalog[Namespace]]?: unknown;
  };
};

/** Locale codes that ship a resource file (`engb` reuses `en`). */
const LOCALE_RESOURCES: Record<Exclude<AppLanguage, "engb">, LocaleResources> = {
  en,
  ja,
  ko,
  th,
  zhs,
  zht,
  es,
  fr,
  it,
  de,
  nl,
  pt,
  ru,
  uk,
};

const REQUIRED_KEYS = (
  Object.entries(en) as Array<[keyof TranslationCatalog, Record<string, string>]>
).flatMap(([namespace, keys]) => Object.keys(keys).map((key) => [namespace, key] as const));

function assertNonEmptyString(value: unknown, label: string): void {
  expect(typeof value, label).toBe("string");
  expect((value as string).trim().length, label).toBeGreaterThan(0);
}

describe("trimmed locale catalogs", () => {
  test("every LANGUAGE_OPTIONS locale (except engb) has the required keys", () => {
    for (const { value } of LANGUAGE_OPTIONS) {
      if (value === "engb") {
        continue;
      }
      const resources = LOCALE_RESOURCES[value];
      expect(resources, `missing resource module for locale "${value}"`).toBeDefined();
      for (const [namespace, key] of REQUIRED_KEYS) {
        const ns = resources[namespace];
        assertNonEmptyString(ns?.[key as keyof typeof ns], `${value}.${namespace}.${key}`);
      }
    }
  });

  test("every resource locale appears in LANGUAGE_OPTIONS", () => {
    const optionCodes = new Set(LANGUAGE_OPTIONS.map((option) => option.value));
    for (const code of Object.keys(LOCALE_RESOURCES)) {
      expect(optionCodes.has(code as AppLanguage), `orphan locale resource "${code}"`).toBe(true);
    }
  });
});
