/** Serializable member fields used for client-side search. */
export type SearchableMember = {
  id: string;
  name?: string;
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

export function memberMatchesQuery(item: SearchableMember, normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return true;
  }

  const name = item.name ? normalizeSearchText(item.name) : "";
  const email = item.email ? normalizeSearchText(item.email) : "";

  return name.includes(normalizedQuery) || email.includes(normalizedQuery);
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
  email?: string;
}): SearchableMember {
  return {
    id: doc.userId,
    name: doc.name,
    email: doc.email,
  };
}
