import { JOIN_CODE_LENGTH, normalizeJoinCodeInput } from "@/lib/invitations/joinCodeFormSchema";
import { JOIN_CODE_PARAM } from "@/lib/invitations/joinCodes";
import { STORAGE_KEYS } from "@/lib/storageKeys";

const JOIN_CODE_STORAGE_KEY = STORAGE_KEYS.pendingJoinCode;

/** In-memory fallback when sessionStorage is unavailable (SSR / some test runners). */
let memoryPendingJoinCode: string | null = null;

function writeStorage(value: string): void {
  memoryPendingJoinCode = value;
  try {
    sessionStorage.setItem(JOIN_CODE_STORAGE_KEY, value);
  } catch {
    // Private mode / quota / missing sessionStorage — memory still set.
  }
}

function readStorage(): string | null {
  try {
    const fromSession = sessionStorage.getItem(JOIN_CODE_STORAGE_KEY);
    if (fromSession != null) {
      memoryPendingJoinCode = fromSession;
      return fromSession;
    }
  } catch {
    // fall through to memory
  }
  return memoryPendingJoinCode;
}

function removeStorage(): void {
  memoryPendingJoinCode = null;
  try {
    sessionStorage.removeItem(JOIN_CODE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function stashPendingJoinCode(code: string): void {
  const normalized = normalizeJoinCodeInput(code).slice(0, JOIN_CODE_LENGTH);
  if (!normalized) return;
  writeStorage(normalized);
}

export function peekPendingJoinCode(): string | null {
  return readStorage();
}

export function clearPendingJoinCode(): void {
  removeStorage();
}

export function takePendingJoinCode(): string | null {
  const value = readStorage();
  removeStorage();
  return value;
}

function codeFromSearchString(search: string | undefined | null): string {
  if (!search) return "";
  try {
    const params = new URLSearchParams(
      search.startsWith("?") || search.startsWith("#") ? search : `?${search}`,
    );
    return normalizeJoinCodeInput(params.get(JOIN_CODE_PARAM) ?? "").slice(0, JOIN_CODE_LENGTH);
  } catch {
    return "";
  }
}

/**
 * Resolve a join code for OTP prefill.
 * Order: typed route search → browser/location search string → sessionStorage.
 * Does not clear storage; callers clear after state is applied.
 */
export function resolveJoinCodePrefill(options: {
  searchCode?: string | null;
  locationSearch?: string | null;
}): string {
  const fromTypedSearch = normalizeJoinCodeInput(options.searchCode ?? "").slice(
    0,
    JOIN_CODE_LENGTH,
  );
  if (fromTypedSearch) return fromTypedSearch;

  const fromLocation = codeFromSearchString(options.locationSearch);
  if (fromLocation) return fromLocation;

  return normalizeJoinCodeInput(peekPendingJoinCode() ?? "").slice(0, JOIN_CODE_LENGTH);
}

/** Relative path+search+hash for post-login redirect (never an absolute URL). */
export function relativeLocationHref(location: {
  pathname: string;
  searchStr: string;
  hash: string;
}): string {
  const hash = location.hash ? `#${location.hash}` : "";
  return `${location.pathname}${location.searchStr}${hash}`;
}
