import type { Doc, Id } from "../../_generated/dataModel.js";
import { seatAggregateKey, seatAggregateLabel } from "../seatChartLogic.js";

export type SeatLayoutMatrixDimension = "seat" | "zone" | "team" | "neighbor";

export type SeatLayoutMatrixValue = {
  key: string;
  label: string;
};

export type SeatLayoutMatrixStudentCounts = {
  studentUserId: Id<"users">;
  counts: Array<{ key: string; count: number }>;
};

type AggregateLabelRow = Pick<Doc<"seatLayoutAggregates">, "key" | "label">;

export function layoutValuesForSeat(
  layout: Pick<Doc<"seatLayouts">, "_id" | "items">,
): SeatLayoutMatrixValue[] {
  const desks = layout.items
    .filter((item) => item.kind === "desk")
    .sort(
      (a, b) =>
        (a.deskNumber ?? Number.MAX_SAFE_INTEGER) - (b.deskNumber ?? Number.MAX_SAFE_INTEGER),
    );
  return desks.map((desk) => ({
    key: seatAggregateKey(layout._id, desk.id),
    label: seatAggregateLabel(desk.deskNumber),
  }));
}

export function layoutValuesForZone(
  layout: Pick<Doc<"seatLayouts">, "items">,
): SeatLayoutMatrixValue[] {
  const zones = new Set<string>();
  for (const item of layout.items) {
    if (item.kind !== "desk") continue;
    const zone = item.zoneName?.trim();
    if (zone) zones.add(zone);
  }
  return [...zones].sort((a, b) => a.localeCompare(b)).map((zone) => ({ key: zone, label: zone }));
}

/** Merge current layout columns with stale aggregate-only keys (removed desks/zones/teams). */
export function mergeMatrixValues(
  layoutValues: SeatLayoutMatrixValue[],
  aggregateLabels: AggregateLabelRow[],
): SeatLayoutMatrixValue[] {
  const labelsByKey = new Map<string, string>();
  for (const value of layoutValues) {
    labelsByKey.set(value.key, value.label);
  }
  for (const row of aggregateLabels) {
    if (!labelsByKey.has(row.key)) {
      labelsByKey.set(row.key, row.label.trim() || row.key);
    }
  }

  const layoutKeySet = new Set(layoutValues.map((value) => value.key));
  const stale = [...labelsByKey.entries()]
    .filter(([key]) => !layoutKeySet.has(key))
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return [...layoutValues, ...stale];
}

/** Neighbor columns come entirely from recorded history. */
export function valuesFromAggregateLabels(
  aggregateLabels: AggregateLabelRow[],
): SeatLayoutMatrixValue[] {
  const labelsByKey = new Map<string, string>();
  for (const row of aggregateLabels) {
    labelsByKey.set(row.key, row.label.trim() || row.key);
  }
  return [...labelsByKey.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function buildSeatLayoutRosterMatrixCounts(
  values: SeatLayoutMatrixValue[],
  studentUserIds: Id<"users">[],
  aggregateRows: Array<Pick<Doc<"seatLayoutAggregates">, "studentUserId" | "key" | "count">>,
): SeatLayoutMatrixStudentCounts[] {
  const countsByStudent = new Map<string, Map<string, number>>();
  for (const studentUserId of studentUserIds) {
    countsByStudent.set(studentUserId, new Map(values.map((value) => [value.key, 0] as const)));
  }

  for (const row of aggregateRows) {
    const studentCounts = countsByStudent.get(row.studentUserId);
    if (!studentCounts) continue;
    studentCounts.set(row.key, (studentCounts.get(row.key) ?? 0) + row.count);
  }

  return studentUserIds.map((studentUserId) => ({
    studentUserId,
    counts: values.map((value) => ({
      key: value.key,
      count: countsByStudent.get(studentUserId)?.get(value.key) ?? 0,
    })),
  }));
}
