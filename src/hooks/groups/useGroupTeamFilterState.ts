import { useCallback, useMemo, useSyncExternalStore } from "react";

import {
  clearGroupTeamFilters,
  getGroupTeamFiltersSnapshot,
  getServerGroupTeamFiltersSnapshot,
  subscribeGroupTeamFilters,
  toggleGroupFilter,
  toggleTeamFilter,
  toggleUngroupedFilter,
  writeGroupTeamFilters,
  type GroupTeamFilterState,
} from "@/lib/groups/groupTeamFilters";
import type { Id } from "../../../convex/_generated/dataModel";

export type UseGroupTeamFilterStateResult = GroupTeamFilterState & {
  toggleGroup: (groupId: Id<"groups"> | string) => void;
  toggleTeam: (teamId: Id<"teams"> | string) => void;
  toggleUngrouped: () => void;
  clear: () => void;
  setState: (next: GroupTeamFilterState) => void;
};

export function useGroupTeamFilterState(classId: Id<"classes">): UseGroupTeamFilterStateResult {
  const classIdKey = classId as string;

  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeGroupTeamFilters(classIdKey, onStoreChange),
    [classIdKey],
  );

  const getSnapshot = useCallback(() => getGroupTeamFiltersSnapshot(classIdKey), [classIdKey]);

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerGroupTeamFiltersSnapshot);

  const setState = useCallback(
    (next: GroupTeamFilterState) => {
      writeGroupTeamFilters(classIdKey, next);
    },
    [classIdKey],
  );

  const toggleGroup = useCallback(
    (groupId: Id<"groups"> | string) => {
      setState(toggleGroupFilter(getGroupTeamFiltersSnapshot(classIdKey), String(groupId)));
    },
    [classIdKey, setState],
  );

  const toggleTeam = useCallback(
    (teamId: Id<"teams"> | string) => {
      setState(toggleTeamFilter(getGroupTeamFiltersSnapshot(classIdKey), String(teamId)));
    },
    [classIdKey, setState],
  );

  const toggleUngrouped = useCallback(() => {
    setState(toggleUngroupedFilter(getGroupTeamFiltersSnapshot(classIdKey)));
  }, [classIdKey, setState]);

  const clear = useCallback(() => {
    setState(clearGroupTeamFilters());
  }, [setState]);

  return useMemo(
    () => ({
      ...state,
      toggleGroup,
      toggleTeam,
      toggleUngrouped,
      clear,
      setState,
    }),
    [state, toggleGroup, toggleTeam, toggleUngrouped, clear, setState],
  );
}
