import {
  createRandomAssignerFormSchema,
  MAX_RANDOM_ASSIGNER_ITEMS,
  RANDOM_ASSIGNER_MESSAGES_EN,
  type RandomAssignerFormValues,
  type RandomAssignerScope,
} from "../../../convex/lib/assigners/randomAssignerSchema";
import type { Id } from "../../../convex/_generated/dataModel";

export type RandomAssignerListItem = {
  _id: Id<"randomAssigners">;
  _creationTime: number;
  name: string;
  items: string[];
  defaultReplicates: boolean;
  defaultScope: RandomAssignerScope;
  createdBy: Id<"users">;
  createdAt: number;
  updatedAt: number;
  runCount: number;
  latestRunId: Id<"randomAssignerRuns"> | null;
  latestRunAt: number | null;
};

export type RandomAssignerDetail = {
  _id: Id<"randomAssigners">;
  _creationTime: number;
  classId: Id<"classes">;
  name: string;
  items: string[];
  defaultReplicates: boolean;
  defaultScope: RandomAssignerScope;
  createdBy: Id<"users">;
  createdAt: number;
  updatedAt: number;
};

export type RandomAssignerRunListItem = {
  _id: Id<"randomAssignerRuns">;
  _creationTime: number;
  assignerId: Id<"randomAssigners">;
  ranAt: number;
  ranBy: Id<"users">;
  scope: RandomAssignerScope;
  replicates: boolean;
  assignmentCount: number;
};

export type RandomAssignerAssignment = {
  studentUserId: Id<"users">;
  studentDisplayName: string;
  item: string;
  rosterNumber?: number;
  firstName?: string;
  lastName?: string;
  groupId?: Id<"groups">;
  groupName?: string;
};

export type RandomAssignerRunDetail = {
  _id: Id<"randomAssignerRuns">;
  _creationTime: number;
  classId: Id<"classes">;
  assignerId: Id<"randomAssigners">;
  assignerName: string;
  ranAt: number;
  ranBy: Id<"users">;
  scope: RandomAssignerScope;
  replicates: boolean;
  itemsSnapshot: string[];
  assignments: RandomAssignerAssignment[];
};

export type RandomAssignerDisplayRun = RandomAssignerRunDetail & {
  nameFormat: {
    order: "firstLast" | "lastFirst";
    space: boolean;
  };
};

export function createClientRandomAssignerFormSchema(
  messages: Partial<typeof RANDOM_ASSIGNER_MESSAGES_EN> = {},
) {
  return createRandomAssignerFormSchema({ ...RANDOM_ASSIGNER_MESSAGES_EN, ...messages });
}

export function emptyRandomAssignerFormValues(): RandomAssignerFormValues {
  return {
    name: "",
    items: [""],
    defaultReplicates: false,
    defaultScope: "class",
  };
}

export function randomAssignerFormValuesFromDetail(
  detail: RandomAssignerDetail,
): RandomAssignerFormValues {
  return {
    name: detail.name,
    items: detail.items.length > 0 ? [...detail.items] : [""],
    defaultReplicates: detail.defaultReplicates,
    defaultScope: detail.defaultScope,
  };
}

export function randomAssignerMutationPayloadFromForm(values: RandomAssignerFormValues) {
  const trimmedItems = values.items.map((item) => item.trim()).filter((item) => item.length > 0);
  return {
    name: values.name.trim(),
    items: trimmedItems,
    defaultReplicates: values.defaultReplicates,
    defaultScope: values.defaultScope,
  };
}

export function randomAssignerDisplayUrl(runId: Id<"randomAssignerRuns">): string {
  return new URL(`/d/${runId}`, window.location.origin).href;
}

export function formatRandomAssignerScope(
  scope: RandomAssignerScope,
  t: (key: string) => string,
): string {
  return scope === "groups" ? t("randomScopeGroups") : t("randomScopeClass");
}

export function formatRandomAssignerReplicates(
  replicates: boolean,
  t: (key: string) => string,
): string {
  return replicates ? t("randomReplicatesOn") : t("randomReplicatesOff");
}

/** Full Latin alphabet — common Chromebook / locker labels. */
export const RANDOM_ASSIGNER_PRESET_LETTERS: readonly string[] = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
];

/** Letters with enclosed counters omitted (A, B, D, O, P, Q). */
export const RANDOM_ASSIGNER_PRESET_CLOSED_LETTERS: readonly string[] =
  RANDOM_ASSIGNER_PRESET_LETTERS.filter(
    (letter) => !["A", "B", "D", "O", "P", "Q"].includes(letter),
  );

/** Digits allowed in closed-number labels (omits 0, 4, 6, 8, 9). */
export const RANDOM_ASSIGNER_CLOSED_NUMBER_DIGITS = ["1", "2", "3", "5", "7"] as const;

export const RANDOM_ASSIGNER_ITEM_PRESET_IDS = [
  "letters",
  "closedLetters",
  "numbers",
  "closedNumbers",
] as const;

export type RandomAssignerItemPresetId = (typeof RANDOM_ASSIGNER_ITEM_PRESET_IDS)[number];

export function isClosedRandomAssignerNumber(value: string): boolean {
  if (value.length === 0) return false;
  return [...value].every((digit) =>
    (RANDOM_ASSIGNER_CLOSED_NUMBER_DIGITS as readonly string[]).includes(digit),
  );
}

export function randomAssignerPresetMaxCount(presetId: RandomAssignerItemPresetId): number {
  switch (presetId) {
    case "letters":
      return RANDOM_ASSIGNER_PRESET_LETTERS.length;
    case "closedLetters":
      return RANDOM_ASSIGNER_PRESET_CLOSED_LETTERS.length;
    case "numbers":
    case "closedNumbers":
      return MAX_RANDOM_ASSIGNER_ITEMS;
  }
}

export function randomAssignerItemsForPreset(
  presetId: RandomAssignerItemPresetId,
  count: number,
): string[] {
  const max = randomAssignerPresetMaxCount(presetId);
  const n = Math.min(max, Math.max(0, Math.floor(count)));
  if (n <= 0) return [];

  switch (presetId) {
    case "letters":
      return RANDOM_ASSIGNER_PRESET_LETTERS.slice(0, n).map(String);
    case "closedLetters":
      return RANDOM_ASSIGNER_PRESET_CLOSED_LETTERS.slice(0, n).map(String);
    case "numbers":
      return Array.from({ length: n }, (_, index) => String(index + 1));
    case "closedNumbers": {
      const items: string[] = [];
      let next = 1;
      while (items.length < n) {
        const value = String(next);
        next += 1;
        if (!isClosedRandomAssignerNumber(value)) continue;
        items.push(value);
      }
      return items;
    }
  }
}

/** Append up to `count` unused preset items onto the list. */
export function mergeRandomAssignerPresetItems(
  currentItems: string[],
  presetId: RandomAssignerItemPresetId,
  count: number,
): string[] {
  const existing = currentItems.map((item) => item.trim()).filter((item) => item.length > 0);
  const existingSet = new Set(existing);
  const requested = Math.max(0, Math.floor(count));
  if (requested <= 0) {
    return existing.length > 0 ? existing : [""];
  }

  const additions: string[] = [];
  const room = MAX_RANDOM_ASSIGNER_ITEMS - existing.length;

  if (presetId === "numbers" || presetId === "closedNumbers") {
    let next = 1;
    while (additions.length < requested && additions.length < room) {
      const item = String(next);
      next += 1;
      if (presetId === "closedNumbers" && !isClosedRandomAssignerNumber(item)) continue;
      if (existingSet.has(item)) continue;
      additions.push(item);
    }
  } else {
    const pool =
      presetId === "letters"
        ? RANDOM_ASSIGNER_PRESET_LETTERS
        : RANDOM_ASSIGNER_PRESET_CLOSED_LETTERS;
    for (const item of pool) {
      if (additions.length >= requested || additions.length >= room) break;
      if (existingSet.has(item)) continue;
      additions.push(item);
    }
  }

  const merged = [...existing, ...additions];
  return merged.length > 0 ? merged : [""];
}

export type RandomAssignerRunSortKey = "ranAt" | "scope" | "replicates" | "assignmentCount";
export type RandomAssignerRunSortDirection = "asc" | "desc";

export function nextRandomAssignerRunSortState(
  currentKey: RandomAssignerRunSortKey,
  currentDirection: RandomAssignerRunSortDirection,
  nextKey: RandomAssignerRunSortKey,
): { sortKey: RandomAssignerRunSortKey; sortDirection: RandomAssignerRunSortDirection } {
  if (currentKey === nextKey) {
    return {
      sortKey: currentKey,
      sortDirection: currentDirection === "asc" ? "desc" : "asc",
    };
  }
  return {
    sortKey: nextKey,
    sortDirection: nextKey === "ranAt" || nextKey === "assignmentCount" ? "desc" : "asc",
  };
}

function compareRandomAssignerRuns(
  a: RandomAssignerRunListItem,
  b: RandomAssignerRunListItem,
  sortKey: RandomAssignerRunSortKey,
  direction: RandomAssignerRunSortDirection,
): number {
  const dir = direction === "asc" ? 1 : -1;
  switch (sortKey) {
    case "ranAt":
      return (a.ranAt - b.ranAt) * dir;
    case "scope":
      return a.scope.localeCompare(b.scope) * dir;
    case "replicates":
      return (Number(a.replicates) - Number(b.replicates)) * dir;
    case "assignmentCount":
      return (a.assignmentCount - b.assignmentCount) * dir;
  }
}

export function sortRandomAssignerRuns(
  runs: RandomAssignerRunListItem[],
  sortKey: RandomAssignerRunSortKey,
  direction: RandomAssignerRunSortDirection,
): RandomAssignerRunListItem[] {
  return [...runs].sort((a, b) => {
    const primary = compareRandomAssignerRuns(a, b, sortKey, direction);
    if (primary !== 0) return primary;
    return b.ranAt - a.ranAt;
  });
}

export type { RandomAssignerFormValues, RandomAssignerScope };
