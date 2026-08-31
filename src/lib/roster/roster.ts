import type { Id } from "../../../convex/_generated/dataModel";
import { getDisplayName } from "@/lib/user/userDisplay";

export const GENDER_OPTIONS = [
  "male",
  "female",
  "transMale",
  "transFemale",
  "nonBinary",
  "selfDescribe",
  "preferNotToSay",
] as const;

export type GenderOption = (typeof GENDER_OPTIONS)[number];

export const PRONOUN_OPTIONS = [
  "heHim",
  "sheHer",
  "theyThem",
  "heThey",
  "sheThey",
  "useNameOnly",
  "askSelfDescribe",
  "preferNotToSay",
] as const;

export type PronounOption = (typeof PRONOUN_OPTIONS)[number];

export type StudentsViewMode = "grid" | "table";

export const ROSTER_COLUMN_IDS = [
  "rosterNumber",
  "lastName",
  "firstName",
  "name",
  "email",
  "gender",
  "pronouns",
] as const;

export type RosterColumnId = (typeof ROSTER_COLUMN_IDS)[number];

export const DEFAULT_ROSTER_COLUMN_ORDER: RosterColumnId[] = [...ROSTER_COLUMN_IDS];

export const DEFAULT_ROSTER_COLUMN_VISIBILITY: Record<RosterColumnId, boolean> = {
  rosterNumber: true,
  lastName: true,
  firstName: true,
  name: true,
  email: true,
  gender: true,
  pronouns: true,
};

export type StudentRosterEntry = {
  userId: Id<"users">;
  rosterNumber: number;
  firstName?: string;
  lastName?: string;
  name?: string;
  image?: string;
  email?: string;
  gender?: GenderOption;
  genderSelfDescribe?: string;
  pronouns?: PronounOption;
  pronounsSelfDescribe?: string;
  role: "student";
};

export type ClassUserSettingsPublic = {
  studentsViewMode?: StudentsViewMode;
  studentsColumnOrder?: string[];
  studentsColumnVisibility?: Record<string, boolean>;
};

export const ROSTER_NAME_ORDERS = ["firstLast", "lastFirst"] as const;
export type RosterNameOrder = (typeof ROSTER_NAME_ORDERS)[number];

export type RosterNameFormat = {
  order: RosterNameOrder;
  space: boolean;
};

export const DEFAULT_ROSTER_NAME_FORMAT: RosterNameFormat = {
  order: "firstLast",
  space: true,
};

/** Combine roster first/last using class display prefs. Returns undefined if both empty. */
export function formatRosterNameParts(
  firstName: string | undefined,
  lastName: string | undefined,
  format: RosterNameFormat = DEFAULT_ROSTER_NAME_FORMAT,
): string | undefined {
  const first = firstName?.trim() || undefined;
  const last = lastName?.trim() || undefined;
  if (!first && !last) return undefined;
  if (!first) return last;
  if (!last) return first;
  const ordered = format.order === "lastFirst" ? [last, first] : [first, last];
  return ordered.join(format.space ? " " : "");
}

export function resolveRosterNameFormat(input: {
  rosterNameOrder?: RosterNameOrder | null;
  rosterNameSpace?: boolean | null;
}): RosterNameFormat {
  return {
    order: input.rosterNameOrder === "lastFirst" ? "lastFirst" : "firstLast",
    space: input.rosterNameSpace !== false,
  };
}

/** Prefer roster first+last when set; otherwise `users.name` / email fallback. */
export function getRosterDisplayName(
  student: Pick<StudentRosterEntry, "userId" | "firstName" | "lastName" | "name" | "email">,
  unnamedFallback: string,
  format: RosterNameFormat = DEFAULT_ROSTER_NAME_FORMAT,
): string {
  const rosterName = formatRosterNameParts(student.firstName, student.lastName, format);
  if (rosterName) {
    return rosterName;
  }
  return getDisplayName(
    { _id: student.userId, name: student.name, email: student.email },
    unnamedFallback,
  );
}

export type CompactRosterStudent = Pick<
  StudentRosterEntry,
  "userId" | "firstName" | "lastName" | "name" | "email"
>;

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function nfcTrim(value: string | undefined): string {
  return value?.trim().normalize("NFC") ?? "";
}

/** True when the surname has letters and every letter is Latin script. */
function isLatinScriptSurname(surname: string): boolean {
  let sawLetter = false;
  for (const ch of surname) {
    if (/\p{L}/u.test(ch)) {
      sawLetter = true;
      if (!/\p{Script=Latin}/u.test(ch)) return false;
    }
  }
  return sawLetter;
}

function letterGraphemes(value: string): string[] {
  const letters: string[] = [];
  for (const { segment } of graphemeSegmenter.segment(value)) {
    if (/\p{L}/u.test(segment)) letters.push(segment);
  }
  return letters;
}

function lettersEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((letter, index) => letter === right[index]);
}

/** Shortest letter prefix that differs from another surname; 1 when they match. */
function distinguishingPrefixLength(letters: readonly string[], other: readonly string[]): number {
  const max = Math.max(letters.length, other.length);
  for (let index = 0; index < max; index++) {
    if (letters[index] !== other[index]) return index + 1;
  }
  return 1;
}

function latinSurnamePrefixLength(
  letters: readonly string[],
  peers: readonly (readonly string[])[],
): number {
  let needed = 1;
  for (const other of peers) {
    if (lettersEqual(letters, other)) continue;
    needed = Math.max(needed, distinguishingPrefixLength(letters, other));
  }
  return Math.min(needed, letters.length);
}

/**
 * Compact given names for square cards, disambiguated from the full roster.
 * Unique given names stay as-is. Latin-script surname collisions become
 * `Alex K.`, or a longer prefix (`Alex Ki.`) when initials also match.
 * Identical full names keep the shortest Latin label. Non-Latin or
 * mixed-script collisions use the full roster name.
 */
export function compactRosterDisplayNames(
  students: readonly CompactRosterStudent[],
  unnamedFallback: string,
  format: RosterNameFormat = DEFAULT_ROSTER_NAME_FORMAT,
): Map<Id<"users">, string> {
  const givenCounts = new Map<string, number>();
  const parsed = students.map((student) => {
    const givenName = nfcTrim(student.firstName);
    const lastName = nfcTrim(student.lastName);
    const latinLetters =
      lastName && isLatinScriptSurname(lastName) ? letterGraphemes(lastName) : undefined;
    if (givenName) {
      givenCounts.set(givenName, (givenCounts.get(givenName) ?? 0) + 1);
    }
    return { student, givenName, lastName, latinLetters };
  });

  const latinPeersByGiven = new Map<string, string[][]>();
  for (const { givenName, latinLetters } of parsed) {
    if (!givenName || !latinLetters || latinLetters.length === 0) continue;
    if ((givenCounts.get(givenName) ?? 0) <= 1) continue;
    const peers = latinPeersByGiven.get(givenName);
    if (peers) peers.push(latinLetters);
    else latinPeersByGiven.set(givenName, [latinLetters]);
  }

  const result = new Map<Id<"users">, string>();
  for (const { student, givenName, lastName, latinLetters } of parsed) {
    if (!givenName) {
      result.set(student.userId, getRosterDisplayName(student, unnamedFallback, format));
      continue;
    }
    const colliding = (givenCounts.get(givenName) ?? 0) > 1;
    if (!colliding) {
      result.set(student.userId, givenName);
      continue;
    }
    if (latinLetters && latinLetters.length > 0) {
      const prefixLength = latinSurnamePrefixLength(
        latinLetters,
        latinPeersByGiven.get(givenName) ?? [],
      );
      result.set(student.userId, `${givenName} ${latinLetters.slice(0, prefixLength).join("")}.`);
      continue;
    }
    if (lastName) {
      result.set(student.userId, getRosterDisplayName(student, unnamedFallback, format));
      continue;
    }
    result.set(student.userId, givenName);
  }
  return result;
}

export function genderLabelKey(gender: GenderOption): `gender_${GenderOption}` {
  return `gender_${gender}`;
}

export function pronounLabelKey(pronouns: PronounOption): `pronouns_${PronounOption}` {
  return `pronouns_${pronouns}`;
}

export function normalizeColumnOrder(order: string[] | undefined): RosterColumnId[] {
  const allowed = new Set<string>(ROSTER_COLUMN_IDS);
  const seen = new Set<RosterColumnId>();
  const result: RosterColumnId[] = [];
  for (const id of order ?? []) {
    if (!allowed.has(id) || seen.has(id as RosterColumnId)) continue;
    result.push(id as RosterColumnId);
    seen.add(id as RosterColumnId);
  }
  for (const id of DEFAULT_ROSTER_COLUMN_ORDER) {
    if (!seen.has(id)) result.push(id);
  }
  return result;
}

export function normalizeColumnVisibility(
  visibility: Record<string, boolean> | undefined,
): Record<RosterColumnId, boolean> {
  const result = { ...DEFAULT_ROSTER_COLUMN_VISIBILITY };
  for (const id of ROSTER_COLUMN_IDS) {
    if (typeof visibility?.[id] === "boolean") {
      result[id] = visibility[id];
    }
  }
  return result;
}

/** Rewrite 1-based roster numbers from an ordered userId list. Null if the sets don't match. */
export function applyRosterOrder(
  entries: StudentRosterEntry[],
  userIds: Id<"users">[],
): StudentRosterEntry[] | null {
  if (userIds.length !== entries.length) return null;
  const byId = new Map(entries.map((entry) => [entry.userId, entry] as const));
  const next: StudentRosterEntry[] = [];
  for (let i = 0; i < userIds.length; i++) {
    const entry = byId.get(userIds[i]);
    if (!entry) return null;
    next.push({ ...entry, rosterNumber: i + 1 });
  }
  return next;
}
