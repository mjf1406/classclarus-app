import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./resources/en";
import {
  getLanguageOption,
  isAppLanguage,
  LANGUAGE_OPTIONS,
  type AppLanguage,
} from "@/lib/languages";
import { APP_CONFIG } from "@/config/app";
import { readStoredLanguage } from "./storage";

const localeLoaders: Record<
  Exclude<AppLanguage, "en" | "engb">,
  () => Promise<{ default: Record<string, Record<string, unknown>> }>
> = {
  ja: () => import("./resources/ja"),
  ko: () => import("./resources/ko"),
  th: () => import("./resources/th"),
  zhs: () => import("./resources/zhs"),
  zht: () => import("./resources/zht"),
  es: () => import("./resources/es"),
  fr: () => import("./resources/fr"),
  it: () => import("./resources/it"),
  de: () => import("./resources/de"),
  nl: () => import("./resources/nl"),
  pt: () => import("./resources/pt"),
  ru: () => import("./resources/ru"),
  uk: () => import("./resources/uk"),
};

const loadedLocales = new Set<AppLanguage>(["en", "engb"]);
const localeLoadPromises = new Map<AppLanguage, Promise<void>>();

function addLocaleBundles(language: AppLanguage, bundles: Record<string, Record<string, unknown>>) {
  for (const [namespace, resources] of Object.entries(bundles)) {
    i18n.addResourceBundle(language, namespace, resources, true, true);
  }
  loadedLocales.add(language);
}

/** Load locale resource bundles (no-op if already loaded). `engb` shares `en`. */
export async function ensureLocaleLoaded(language: AppLanguage): Promise<void> {
  if (language === "en" || language === "engb") {
    return;
  }
  if (loadedLocales.has(language)) {
    return;
  }

  const existing = localeLoadPromises.get(language);
  if (existing) {
    await existing;
    return;
  }

  const loadPromise = (async () => {
    const loader = localeLoaders[language];
    const mod = await loader();
    addLocaleBundles(language, mod.default);
  })();

  localeLoadPromises.set(language, loadPromise);
  try {
    await loadPromise;
  } finally {
    localeLoadPromises.delete(language);
  }
}

export function normalizeBrowserLanguage(language: string): AppLanguage | null {
  const normalized = language.toLowerCase();

  if (
    normalized === "zh-tw" ||
    normalized === "zh-hk" ||
    normalized === "zh-mo" ||
    normalized === "zh-cht" ||
    normalized.includes("hant")
  ) {
    return "zht";
  }
  if (normalized.startsWith("zh")) {
    return "zhs";
  }
  if (normalized === "en-gb" || normalized === "en-uk" || normalized.startsWith("en-gb")) {
    return "engb";
  }
  if (normalized === "en-us" || normalized.startsWith("en")) {
    return "en";
  }

  const baseLanguage = normalized.split("-")[0];
  return isAppLanguage(baseLanguage) ? baseLanguage : null;
}

export function getInitialLanguage(): AppLanguage {
  const storedLanguage = readStoredLanguage();
  if (storedLanguage) {
    return storedLanguage;
  }

  if (typeof navigator !== "undefined") {
    for (const language of navigator.languages) {
      const supportedLanguage = normalizeBrowserLanguage(language);
      if (supportedLanguage) {
        return supportedLanguage;
      }
    }
  }

  return "en";
}

export function updateDocumentLanguage(language: AppLanguage): void {
  const option = getLanguageOption(language);
  document.documentElement.lang = option.htmlLang;
  document.documentElement.dir = "ltr";
}

void i18n.use(initReactI18next).init({
  resources: {
    en,
    engb: en,
  },
  partialBundledLanguages: true,
  lng: getInitialLanguage(),
  initAsync: false,
  fallbackLng: "en",
  supportedLngs: LANGUAGE_OPTIONS.map((option) => option.value),
  defaultNS: "common",
  interpolation: {
    escapeValue: false,
    defaultVariables: {
      appName: APP_CONFIG.name,
    },
  },
  react: {
    useSuspense: false,
  },
});

updateDocumentLanguage(getInitialLanguage());
i18n.on("languageChanged", (language) => {
  if (isAppLanguage(language)) {
    updateDocumentLanguage(language);
  }
});

export default i18n;
