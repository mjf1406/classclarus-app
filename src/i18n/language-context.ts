import { createContext, useContext } from "react";

import type { AppLanguage } from "@/lib/languages";

export type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
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
