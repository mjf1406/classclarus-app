export type RosterNameOrder = "firstLast" | "lastFirst";

export type RosterNameFormat = {
  order: RosterNameOrder;
  space: boolean;
};

export const DEFAULT_ROSTER_NAME_FORMAT: RosterNameFormat = {
  order: "firstLast",
  space: true,
};

export function resolveRosterNameFormat(input: {
  rosterNameOrder?: RosterNameOrder | null;
  rosterNameSpace?: boolean | null;
}): RosterNameFormat {
  return {
    order: input.rosterNameOrder === "lastFirst" ? "lastFirst" : "firstLast",
    space: input.rosterNameSpace !== false,
  };
}

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
