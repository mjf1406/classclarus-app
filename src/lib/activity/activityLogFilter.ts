import { normalizeSearchText } from "@/lib/members/memberSearch";

/** Serializable activity fields used for worker-side filtering. */
export type FilterableActivityRow = {
  id: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  summary: string;
};

export type ActivityLogFilterCriteria = {
  emailQuery: string;
  summaryQuery: string;
  actions: string[];
  roles: string[];
};

export type ActivityLogFilterRequest = {
  type: "filter";
  requestId: number;
  items: FilterableActivityRow[];
  criteria: ActivityLogFilterCriteria;
};

export type ActivityLogFilterResponse = {
  type: "filterResult";
  requestId: number;
  ids: string[];
};

export function hasActivityLogFilters(criteria: ActivityLogFilterCriteria): boolean {
  return (
    criteria.emailQuery.trim().length > 0 ||
    criteria.summaryQuery.trim().length > 0 ||
    criteria.actions.length > 0 ||
    criteria.roles.length > 0
  );
}

export function activityRowMatchesCriteria(
  item: FilterableActivityRow,
  criteria: ActivityLogFilterCriteria,
): boolean {
  const emailQuery = normalizeSearchText(criteria.emailQuery);
  if (emailQuery && !normalizeSearchText(item.actorEmail).includes(emailQuery)) {
    return false;
  }

  const summaryQuery = normalizeSearchText(criteria.summaryQuery);
  if (summaryQuery && !normalizeSearchText(item.summary).includes(summaryQuery)) {
    return false;
  }

  if (criteria.actions.length > 0 && !criteria.actions.includes(item.action)) {
    return false;
  }

  if (criteria.roles.length > 0 && !criteria.roles.includes(item.actorRole)) {
    return false;
  }

  return true;
}

/** Pure matcher used by the worker and unit tests. */
export function filterActivityIds(
  items: readonly FilterableActivityRow[],
  criteria: ActivityLogFilterCriteria,
): string[] {
  if (!hasActivityLogFilters(criteria)) {
    return items.map((item) => item.id);
  }

  const ids: string[] = [];
  for (const item of items) {
    if (activityRowMatchesCriteria(item, criteria)) {
      ids.push(item.id);
    }
  }
  return ids;
}

export function toFilterableActivityRow(row: {
  _id: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  summary: string;
}): FilterableActivityRow {
  return {
    id: row._id,
    actorEmail: row.actorEmail,
    actorRole: row.actorRole,
    action: row.action,
    summary: row.summary,
  };
}
