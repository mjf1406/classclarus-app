/** Serializable catalog fields used for client-side search. */
export type SearchablePointsCatalogItem = {
  id: string;
  name: string;
  description?: string;
};

export type PointsCatalogSearchRequest = {
  type: "search";
  requestId: number;
  query: string;
  items: SearchablePointsCatalogItem[];
};

export type PointsCatalogSearchResponse = {
  type: "searchResult";
  requestId: number;
  ids: string[];
};

export function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");
}

export function pointsCatalogItemMatchesQuery(
  item: SearchablePointsCatalogItem,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) {
    return true;
  }

  const name = normalizeSearchText(item.name);
  if (name.includes(normalizedQuery)) return true;

  if (item.description) {
    return normalizeSearchText(item.description).includes(normalizedQuery);
  }

  return false;
}

/** Pure matcher used by the worker and unit tests. */
export function filterPointsCatalogIds(
  items: readonly SearchablePointsCatalogItem[],
  query: string,
): string[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return items.map((item) => item.id);
  }

  const ids: string[] = [];
  for (const item of items) {
    if (pointsCatalogItemMatchesQuery(item, normalizedQuery)) {
      ids.push(item.id);
    }
  }
  return ids;
}

export function toSearchablePointsCatalogItem(doc: {
  _id: string;
  name: string;
  description?: string;
}): SearchablePointsCatalogItem {
  return {
    id: doc._id,
    name: doc.name,
    description: doc.description,
  };
}
