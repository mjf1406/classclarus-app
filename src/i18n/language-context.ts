import { createContext, useContext } from "react";

import type { AppLanguage } from "@/lib/languages";

export type LanguageContextValue = {
  /** Effective UI language (override ?? preferred). */
  language: AppLanguage;
  /** User's personal language preference (localStorage). */
  preferredLanguage: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  /** Temporary i18n override that does not write localStorage. Pass null to clear. */
  setLanguageOverride: (language: AppLanguage | null) => void;
  isLanguageOverridden: boolean;
  isSaving: boolean;
};

export const LanguageContext = createContext<LanguageContextValue | null>(null);

export function useAppLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useAppLanguage must be used within a LanguageProvider");
  }
  return context;
}
