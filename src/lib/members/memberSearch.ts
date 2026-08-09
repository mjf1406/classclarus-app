/** Serializable member fields used for client-side search. */
export type SearchableMember = {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

export type MemberSearchRequest = {
  type: "search";
  requestId: number;
  query: string;
  items: SearchableMember[];
};

export type MemberSearchResponse = {
  type: "searchResult";
  requestId: number;
  ids: string[];
};

export function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");
}

function nameFieldCombos(firstName: string | undefined, lastName: string | undefined): string[] {
  const first = firstName ? normalizeSearchText(firstName) : "";
  const last = lastName ? normalizeSearchText(lastName) : "";
  if (!first && !last) {
    return [];
  }
  const partsFirstLast = [first, last].filter(Boolean);
  const partsLastFirst = [last, first].filter(Boolean);
  return [
    partsFirstLast.join(" "),
    partsFirstLast.join(""),
    partsLastFirst.join(" "),
    partsLastFirst.join(""),
  ];
}

export function memberMatchesQuery(item: SearchableMember, normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return true;
  }

  const fields = [item.name, item.firstName, item.lastName, item.email]
    .filter((value): value is string => Boolean(value))
    .map(normalizeSearchText);

  if (fields.some((field) => field.includes(normalizedQuery))) {
    return true;
  }

  // Full-name queries ("Ada Lovelace") when first/last live in separate roster columns.
  const combos = nameFieldCombos(item.firstName, item.lastName);
  if (combos.some((combo) => combo.includes(normalizedQuery))) {
    return true;
  }

  // Token match: every query word must appear in some name/email field.
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    const haystack = [...fields, ...combos];
    return tokens.every((token) => haystack.some((field) => field.includes(token)));
  }

  return false;
}

/** Pure matcher used by the worker and unit tests. */
export function filterMemberIds(items: readonly SearchableMember[], query: string): string[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return items.map((item) => item.id);
  }

  const ids: string[] = [];
  for (const item of items) {
    if (memberMatchesQuery(item, normalizedQuery)) {
      ids.push(item.id);
    }
  }
  return ids;
}

export function toSearchableMember(doc: {
  userId: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}): SearchableMember {
  return {
    id: doc.userId,
    name: doc.name,
    firstName: doc.firstName,
    lastName: doc.lastName,
    email: doc.email,
  };
}
