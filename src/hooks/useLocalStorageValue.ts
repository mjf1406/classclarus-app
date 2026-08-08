import { useCallback, useSyncExternalStore } from "react";

import {
  getLocalStorageValueSnapshot,
  getServerLocalStorageValueSnapshot,
  subscribeLocalStorageValue,
  writeLocalStorageValue,
} from "@/lib/localStorageValue";

/**
 * Persist a validated string enum in localStorage (cross-tab via storage events).
 */
export function useLocalStorageValue<T extends string>(
  key: string,
  defaultValue: T,
  isValid: (value: string) => value is T,
): [T, (value: T) => void] {
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeLocalStorageValue(key, onStoreChange),
    [key],
  );

  const getSnapshot = useCallback(
    () => getLocalStorageValueSnapshot(key, defaultValue, isValid),
    [key, defaultValue, isValid],
  );

  const getServerSnapshot = useCallback(
    () => getServerLocalStorageValueSnapshot(defaultValue),
    [defaultValue],
  );

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: T) => {
      writeLocalStorageValue(key, next);
    },
    [key],
  );

  return [value, setValue];
}
