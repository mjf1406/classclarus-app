/** Serializable class fields used for client-side search. */
export type SearchableClass = {
  id: string;
  name: string;
  year: number;
  description?: string;
};

export type ClassSearchRequest = {
  type: "search";
  requestId: number;
  query: string;
  items: SearchableClass[];
};

export type ClassSearchResponse = {
  type: "searchResult";
  requestId: number;
  ids: string[];
};

export function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");
}

export function classMatchesQuery(item: SearchableClass, normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return true;
  }

  const name = normalizeSearchText(item.name);
  const year = String(item.year);
  const description = item.description ? normalizeSearchText(item.description) : "";

  return (
    name.includes(normalizedQuery) ||
    year.includes(normalizedQuery) ||
    description.includes(normalizedQuery)
  );
}

/** Pure matcher used by the worker and unit tests. */
export function filterClassIds(items: readonly SearchableClass[], query: string): string[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return items.map((item) => item.id);
  }

  const ids: string[] = [];
  for (const item of items) {
    if (classMatchesQuery(item, normalizedQuery)) {
      ids.push(item.id);
    }
  }
  return ids;
}

export function toSearchableClass(doc: {
  _id: string;
  name: string;
  year: number;
  description?: string;
}): SearchableClass {
  return {
    id: doc._id,
    name: doc.name,
    year: doc.year,
    description: doc.description,
  };
}
