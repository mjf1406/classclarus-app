const CHANGE_EVENT = "classclarus-local-storage-value-change";

type ChangeDetail = { key: string };

const snapshotCache = new Map<string, string>();

export function readLocalStorageRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocalStorageRaw(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode / quota / missing storage — still notify in-memory subscribers.
  }
  snapshotCache.set(key, value);
  try {
    window.dispatchEvent(new CustomEvent<ChangeDetail>(CHANGE_EVENT, { detail: { key } }));
  } catch {
    // SSR / test runners without a full window EventTarget.
  }
}

export function readLocalStorageValue<T extends string>(
  key: string,
  defaultValue: T,
  isValid: (value: string) => value is T,
): T {
  const raw = readLocalStorageRaw(key);
  if (raw === null || !isValid(raw)) {
    return defaultValue;
  }
  return raw;
}

export function writeLocalStorageValue<T extends string>(key: string, value: T): void {
  writeLocalStorageRaw(key, value);
}

export function getLocalStorageValueSnapshot<T extends string>(
  key: string,
  defaultValue: T,
  isValid: (value: string) => value is T,
): T {
  const next = readLocalStorageValue(key, defaultValue, isValid);
  const prev = snapshotCache.get(key);
  if (prev === next) {
    return next;
  }
  snapshotCache.set(key, next);
  return next;
}

export function getServerLocalStorageValueSnapshot<T extends string>(defaultValue: T): T {
  return defaultValue;
}

export function subscribeLocalStorageValue(key: string, onStoreChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.storageArea !== localStorage) return;
    if (event.key !== null && event.key !== key) return;
    snapshotCache.delete(key);
    onStoreChange();
  };

  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<ChangeDetail>).detail;
    if (detail?.key !== key) return;
    onStoreChange();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onCustom);
  };
}
