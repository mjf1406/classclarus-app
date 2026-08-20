export type RandomAssignerDataRow = {
  item: string;
  count: number;
};

/** Non-zero item counts for one student, sorted by count desc then label. */
export function buildRandomAssignerDataRows(
  items: string[],
  counts: Map<string, number> | undefined,
): RandomAssignerDataRow[] {
  return items
    .map((item) => ({ item, count: counts?.get(item) ?? 0 }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.item.localeCompare(b.item));
}
