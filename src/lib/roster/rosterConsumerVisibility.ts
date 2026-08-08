import {
  ROSTER_COLUMN_IDS,
  normalizeColumnVisibility,
  type RosterColumnId,
} from "@/lib/roster/roster";

export { rosterConsumerVisibilityStorageKey } from "@/lib/storageKeys";

export function parseRosterConsumerVisibility(
  raw: string | null,
): Record<RosterColumnId, boolean> | null {
  if (raw == null || raw === "") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    let hasAny = false;
    for (const id of ROSTER_COLUMN_IDS) {
      if (typeof record[id] === "boolean") {
        hasAny = true;
        break;
      }
    }
    if (!hasAny) return null;
    return normalizeColumnVisibility(record as Record<string, boolean>);
  } catch {
    return null;
  }
}

export function serializeRosterConsumerVisibility(
  visibility: Record<RosterColumnId, boolean>,
): string {
  return JSON.stringify(visibility);
}
