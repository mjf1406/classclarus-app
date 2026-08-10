import type { Id } from "../../../convex/_generated/dataModel";
import type { GroupsBoard } from "@/lib/groups/groups";
import { groupTeamFiltersStorageKey } from "@/lib/storageKeys";

export type GroupTeamFilterState = {
  groupIds: string[];
  teamIds: string[];
  includeUngrouped: boolean;
};

export type StudentMembership = {
  groupId?: Id<"groups">;
  teamId?: Id<"teams">;
};

export type MembershipByUserId = Record<string, StudentMembership>;

export const EMPTY_GROUP_TEAM_FILTER_STATE: GroupTeamFilterState = {
  groupIds: [],
  teamIds: [],
  includeUngrouped: false,
};

const CHANGE_EVENT = "classclarus-group-team-filters-change";

type ChangeDetail = { classId: string };

const snapshotCache = new Map<string, GroupTeamFilterState>();

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isGroupTeamFilterState(value: unknown): value is GroupTeamFilterState {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<GroupTeamFilterState>;
  return (
    isStringArray(candidate.groupIds) &&
    isStringArray(candidate.teamIds) &&
    typeof candidate.includeUngrouped === "boolean"
  );
}

export function hasGroupTeamMembershipFilters(state: GroupTeamFilterState): boolean {
  return state.groupIds.length > 0 || state.teamIds.length > 0 || state.includeUngrouped;
}

export function groupTeamFilterStatesEqual(
  a: GroupTeamFilterState,
  b: GroupTeamFilterState,
): boolean {
  return (
    a.includeUngrouped === b.includeUngrouped &&
    a.groupIds.length === b.groupIds.length &&
    a.teamIds.length === b.teamIds.length &&
    a.groupIds.every((id, index) => id === b.groupIds[index]) &&
    a.teamIds.every((id, index) => id === b.teamIds[index])
  );
}

function uniqueIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function normalizeState(state: GroupTeamFilterState): GroupTeamFilterState {
  return {
    groupIds: uniqueIds(state.groupIds),
    teamIds: uniqueIds(state.teamIds),
    includeUngrouped: state.includeUngrouped,
  };
}

/** Prefer localStorage; one-time migrate leftover sessionStorage values from older builds. */
function readStoredFiltersRaw(key: string): string | null {
  try {
    const fromLocal = localStorage.getItem(key);
    if (fromLocal) return fromLocal;
  } catch {
    // Private mode / quota.
  }

  try {
    const fromSession = sessionStorage.getItem(key);
    if (!fromSession) return null;
    try {
      localStorage.setItem(key, fromSession);
      sessionStorage.removeItem(key);
    } catch {
      // Keep using the session value for this read if migration fails.
    }
    return fromSession;
  } catch {
    return null;
  }
}

export function readGroupTeamFilters(classId: string): GroupTeamFilterState {
  try {
    const raw = readStoredFiltersRaw(groupTeamFiltersStorageKey(classId));
    if (!raw) {
      return EMPTY_GROUP_TEAM_FILTER_STATE;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isGroupTeamFilterState(parsed)) {
      return EMPTY_GROUP_TEAM_FILTER_STATE;
    }
    return normalizeState(parsed);
  } catch {
    return EMPTY_GROUP_TEAM_FILTER_STATE;
  }
}

export function writeGroupTeamFilters(classId: string, state: GroupTeamFilterState): void {
  const next = normalizeState(state);
  const key = groupTeamFiltersStorageKey(classId);
  try {
    if (!hasGroupTeamMembershipFilters(next)) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(next));
    }
    // Drop legacy session copy if present.
    sessionStorage.removeItem(key);
  } catch {
    // Private mode / quota — still notify subscribers with in-memory snapshot.
  }
  snapshotCache.set(classId, next);
  window.dispatchEvent(new CustomEvent<ChangeDetail>(CHANGE_EVENT, { detail: { classId } }));
}

export function getGroupTeamFiltersSnapshot(classId: string): GroupTeamFilterState {
  const next = readGroupTeamFilters(classId);
  const prev = snapshotCache.get(classId);
  if (prev && groupTeamFilterStatesEqual(prev, next)) {
    return prev;
  }
  snapshotCache.set(classId, next);
  return next;
}

export function getServerGroupTeamFiltersSnapshot(): GroupTeamFilterState {
  return EMPTY_GROUP_TEAM_FILTER_STATE;
}

export function subscribeGroupTeamFilters(classId: string, onStoreChange: () => void): () => void {
  const key = groupTeamFiltersStorageKey(classId);

  const onStorage = (event: StorageEvent) => {
    if (event.storageArea !== localStorage) return;
    if (event.key !== null && event.key !== key) return;
    snapshotCache.delete(classId);
    onStoreChange();
  };

  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<ChangeDetail>).detail;
    if (detail?.classId !== classId) return;
    onStoreChange();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onCustom);
  };
}

export function toggleId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

export function toggleGroupFilter(
  state: GroupTeamFilterState,
  groupId: string,
): GroupTeamFilterState {
  return normalizeState({
    ...state,
    groupIds: toggleId(state.groupIds, groupId),
  });
}

export function toggleTeamFilter(
  state: GroupTeamFilterState,
  teamId: string,
): GroupTeamFilterState {
  return normalizeState({
    ...state,
    teamIds: toggleId(state.teamIds, teamId),
  });
}

export function toggleUngroupedFilter(state: GroupTeamFilterState): GroupTeamFilterState {
  return {
    ...state,
    includeUngrouped: !state.includeUngrouped,
  };
}

export function clearGroupTeamFilters(): GroupTeamFilterState {
  return EMPTY_GROUP_TEAM_FILTER_STATE;
}

/** Teams belonging to the currently selected groups (all teams when no group is selected). */
export function allowedTeamIdsForFilters(
  board: GroupsBoard,
  groupIds: readonly string[],
): Set<string> {
  const selectedGroups = new Set(groupIds);
  const allowed = new Set<string>();
  for (const group of board.groups) {
    if (selectedGroups.size > 0 && !selectedGroups.has(group._id)) {
      continue;
    }
    for (const team of group.teams) {
      allowed.add(team._id);
    }
  }
  return allowed;
}

export function pruneOrphanedTeamIds(
  state: GroupTeamFilterState,
  allowedTeamIds: ReadonlySet<string>,
): GroupTeamFilterState {
  const teamIds = state.teamIds.filter((id) => allowedTeamIds.has(id));
  if (teamIds.length === state.teamIds.length) {
    return state;
  }
  return { ...state, teamIds };
}

export function buildMembershipIndex(board: GroupsBoard): MembershipByUserId {
  const index: MembershipByUserId = {};

  for (const student of board.ungrouped) {
    index[student.userId] = {};
  }

  for (const group of board.groups) {
    for (const student of group.students) {
      index[student.userId] = { groupId: group._id };
    }
    for (const team of group.teams) {
      for (const student of team.students) {
        index[student.userId] = { groupId: group._id, teamId: team._id };
      }
    }
  }

  return index;
}

export function membershipMatchesFilters(
  membership: StudentMembership | undefined,
  state: GroupTeamFilterState,
): boolean {
  if (!hasGroupTeamMembershipFilters(state)) {
    return true;
  }

  const groupId = membership?.groupId;
  const teamId = membership?.teamId;
  const groupDimensionActive = state.groupIds.length > 0 || state.includeUngrouped;
  const teamDimensionActive = state.teamIds.length > 0;

  if (groupDimensionActive) {
    const inSelectedGroup = groupId !== undefined && state.groupIds.includes(groupId);
    const isUngrouped = groupId === undefined;
    const groupMatch =
      (state.includeUngrouped && isUngrouped) || (state.groupIds.length > 0 && inSelectedGroup);
    if (!groupMatch) {
      return false;
    }
  }

  if (teamDimensionActive) {
    if (teamId === undefined || !state.teamIds.includes(teamId)) {
      return false;
    }
  }

  return true;
}
