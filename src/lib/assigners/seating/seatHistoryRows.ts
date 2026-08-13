import type { Id } from "../../../../convex/_generated/dataModel";
import { seatHistoryKey } from "../../../../convex/lib/seating/historyKeys";
import { resolveTeamLabel, type SeatLayoutItem } from "@/lib/assigners/seatLayouts";

export type SeatHistoryValue = {
  key: string;
  label: string;
};

export type SeatHistoryCount = {
  key: string;
  count: number;
};

export type SeatDeskMetadata = {
  zoneName?: string;
  teamLabel?: string;
};

export type SeatHistoryRow = {
  key: string;
  label: string;
  detail?: string;
  count: number;
};

type GroupsForTeamLabel = Parameters<typeof resolveTeamLabel>[1];

export function formatSeatDeskDetail(metadata: SeatDeskMetadata | undefined): string | undefined {
  if (!metadata) return undefined;
  const parts = [metadata.zoneName, metadata.teamLabel].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export function buildSeatDeskMetadataMap(
  layoutId: Id<"seatLayouts">,
  items: SeatLayoutItem[],
  groups: GroupsForTeamLabel,
): Map<string, SeatDeskMetadata> {
  const map = new Map<string, SeatDeskMetadata>();
  for (const item of items) {
    if (item.kind !== "desk") continue;
    const zoneName = item.zoneName?.trim() || undefined;
    const teamLabel = resolveTeamLabel(item.teamAssignment, groups)?.label.trim() || undefined;
    if (!zoneName && !teamLabel) continue;
    map.set(seatHistoryKey(layoutId, item.id), { zoneName, teamLabel });
  }
  return map;
}

/** Non-zero seating history rows for one student, sorted by count desc then label. */
export function buildSeatHistoryRows(
  values: SeatHistoryValue[],
  counts: SeatHistoryCount[] | Map<string, number> | undefined,
  seatMetadataByKey?: Map<string, SeatDeskMetadata>,
): SeatHistoryRow[] {
  const countByKey =
    counts instanceof Map
      ? counts
      : new Map((counts ?? []).map((entry) => [entry.key, entry.count] as const));

  return values
    .map((value) => {
      const detail =
        seatMetadataByKey !== undefined
          ? formatSeatDeskDetail(seatMetadataByKey.get(value.key))
          : undefined;
      return {
        key: value.key,
        label: value.label,
        ...(detail ? { detail } : {}),
        count: countByKey.get(value.key) ?? 0,
      };
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
