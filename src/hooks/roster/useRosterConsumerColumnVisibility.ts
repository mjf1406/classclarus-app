import { useCallback, useMemo, useSyncExternalStore } from "react";

import type { Id } from "../../../convex/_generated/dataModel";
import {
  readLocalStorageRaw,
  subscribeLocalStorageValue,
  writeLocalStorageRaw,
} from "@/lib/localStorageValue";
import {
  parseRosterConsumerVisibility,
  rosterConsumerVisibilityStorageKey,
  serializeRosterConsumerVisibility,
} from "@/lib/roster/rosterConsumerVisibility";
import type { RosterColumnId } from "@/lib/roster/roster";

type CacheEntry = {
  raw: string | null;
  value: Record<RosterColumnId, boolean> | null;
};

const snapshotCache = new Map<string, CacheEntry>();

function getStoredVisibilitySnapshot(key: string): Record<RosterColumnId, boolean> | null {
  const raw = readLocalStorageRaw(key);
  const cached = snapshotCache.get(key);
  if (cached && cached.raw === raw) {
    return cached.value;
  }
  const value = parseRosterConsumerVisibility(raw);
  snapshotCache.set(key, { raw, value });
  return value;
}

/**
 * Consumer-page roster column visibility.
 * Defaults to `/students` prefs until the user toggles columns; then localStorage wins for that surface.
 */
export function useRosterConsumerColumnVisibility(
  classId: Id<"classes">,
  surface: string,
  baseVisibility: Record<RosterColumnId, boolean>,
): {
  columnVisibility: Record<RosterColumnId, boolean>;
  setColumnVisibility: (visibility: Record<RosterColumnId, boolean>) => void;
} {
  const key = useMemo(
    () => rosterConsumerVisibilityStorageKey(classId, surface),
    [classId, surface],
  );

  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeLocalStorageValue(key, onStoreChange),
    [key],
  );

  const getSnapshot = useCallback(() => getStoredVisibilitySnapshot(key), [key]);
  const getServerSnapshot = useCallback(() => null, []);

  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const columnVisibility = stored ?? baseVisibility;

  const setColumnVisibility = useCallback(
    (visibility: Record<RosterColumnId, boolean>) => {
      writeLocalStorageRaw(key, serializeRosterConsumerVisibility(visibility));
    },
    [key],
  );

  return { columnVisibility, setColumnVisibility };
}
