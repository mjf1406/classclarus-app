import { isAppLanguage, type AppLanguage } from "@/lib/languages";
import { LANGUAGE_PREFERENCE, STORAGE_KEYS } from "@/lib/storageKeys";

const LANGUAGE_STORAGE_KEY = STORAGE_KEYS.language;
const LANGUAGE_COOKIE_MAX_AGE_SECONDS = LANGUAGE_PREFERENCE.maxAgeSeconds;

function getSharedLanguageCookieDomain(): string | undefined {
  const host = window.location.hostname;
  if (host === "classclarus.com" || host.endsWith(".classclarus.com")) {
    return LANGUAGE_PREFERENCE.parentDomain;
  }
  return undefined;
}

function readLanguageFromLocalStorage(key: string): AppLanguage | null {
  try {
    const value = window.localStorage.getItem(key);
    return isAppLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

function writeLanguageToLocalStorage(key: string, language: AppLanguage): void {
  try {
    window.localStorage.setItem(key, language);
  } catch {
    // Language switching should still work when storage is unavailable.
  }
}

function readLanguageFromCookie(): AppLanguage | null {
  try {
    const prefix = `${LANGUAGE_STORAGE_KEY}=`;
    const match = document.cookie.split("; ").find((row) => row.startsWith(prefix));
    if (!match) {
      return null;
    }
    const value = decodeURIComponent(match.slice(prefix.length));
    return isAppLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

function writeLanguageToCookie(language: AppLanguage): void {
  try {
    const domain = getSharedLanguageCookieDomain();
    const parts = [
      `${LANGUAGE_STORAGE_KEY}=${encodeURIComponent(language)}`,
      "path=/",
      `max-age=${LANGUAGE_COOKIE_MAX_AGE_SECONDS}`,
      "SameSite=Lax",
    ];
    if (domain) {
      parts.push(`domain=${domain}`);
    }
    document.cookie = parts.join("; ");
  } catch {
    // Cookie writes are best-effort for cross-subdomain sync.
  }
}

export function readStoredLanguage(): AppLanguage | null {
  const fromLocalStorage = readLanguageFromLocalStorage(LANGUAGE_STORAGE_KEY);
  if (fromLocalStorage) {
    return fromLocalStorage;
  }

  const fromCookie = readLanguageFromCookie();
  if (fromCookie) {
    writeLanguageToLocalStorage(LANGUAGE_STORAGE_KEY, fromCookie);
    return fromCookie;
  }

  return null;
}

export function writeStoredLanguage(language: AppLanguage): void {
  writeLanguageToLocalStorage(LANGUAGE_STORAGE_KEY, language);
  writeLanguageToCookie(language);
}
