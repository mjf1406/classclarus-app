import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { isAppLanguage, type AppLanguage } from "@/lib/languages";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import i18n, { ensureLocaleLoaded } from "./index";
import { LanguageContext } from "./language-context";
import { writeStoredLanguage } from "./storage";

function getI18nLanguage(): AppLanguage {
  return isAppLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(getI18nLanguage);
  const [isLocaleLoading, setIsLocaleLoading] = useState(false);

  const applyLanguage = useCallback(async (nextLanguage: AppLanguage) => {
    setIsLocaleLoading(true);
    try {
      await ensureLocaleLoaded(nextLanguage);
      writeStoredLanguage(nextLanguage);
      setLanguageState(nextLanguage);
      await i18n.changeLanguage(nextLanguage);
    } finally {
      setIsLocaleLoading(false);
    }
  }, []);

  /** Apply a language already persisted elsewhere (e.g. another tab) without rewriting storage. */
  const syncLanguage = useCallback(async (nextLanguage: AppLanguage) => {
    if (nextLanguage === getI18nLanguage()) {
      return;
    }
    await ensureLocaleLoaded(nextLanguage);
    setLanguageState(nextLanguage);
    await i18n.changeLanguage(nextLanguage);
  }, []);

  useEffect(() => {
    const handleLanguageChanged = (nextLanguage: string) => {
      if (isAppLanguage(nextLanguage)) {
        setLanguageState(nextLanguage);
      }
    };

    i18n.on("languageChanged", handleLanguageChanged);
    return () => {
      i18n.off("languageChanged", handleLanguageChanged);
    };
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEYS.language || event.newValue === null) {
        return;
      }
      if (!isAppLanguage(event.newValue)) {
        return;
      }
      void syncLanguage(event.newValue);
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [syncLanguage]);

  const setLanguage = useCallback(
    (nextLanguage: AppLanguage) => {
      void applyLanguage(nextLanguage);
    },
    [applyLanguage],
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      isSaving: isLocaleLoading,
    }),
    [isLocaleLoading, language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
