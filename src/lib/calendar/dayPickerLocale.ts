import {
  de,
  enGB,
  enUS,
  es,
  fr,
  it,
  ja,
  ko,
  nl,
  pt,
  ru,
  th,
  uk,
  zhCN,
  zhTW,
  type Locale,
} from "react-day-picker/locale";

import { isAppLanguage, type AppLanguage } from "@/lib/languages";

const DAY_PICKER_LOCALES: Record<AppLanguage, Locale> = {
  en: enUS,
  engb: enGB,
  ja,
  ko,
  th,
  zhs: zhCN,
  zht: zhTW,
  es,
  fr,
  it,
  de,
  nl,
  pt,
  ru,
  uk,
};

export function dayPickerLocaleForLanguage(language: string): Locale {
  return isAppLanguage(language) ? DAY_PICKER_LOCALES[language] : enUS;
}
