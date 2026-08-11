import type { Doc, Id } from "../../_generated/dataModel.js";
import type { LayoutHistoryStats } from "./types.js";

export function emptyStudentHistory(): LayoutHistoryStats["byStudent"] extends Map<
  Id<"users">,
  infer V
>
  ? V
  : never {
  return {
    seat: new Map(),
    zone: new Map(),
    team: new Map(),
    neighbor: new Map(),
    combination: new Map(),
    total: 0,
  };
}

export function buildLayoutHistoryStats(
  rows: ReadonlyArray<
    Pick<Doc<"seatLayoutAggregates">, "studentUserId" | "dimension" | "key" | "count">
  >,
): LayoutHistoryStats {
  const byStudent = new Map<
    Id<"users">,
    {
      seat: Map<string, number>;
      zone: Map<string, number>;
      team: Map<string, number>;
      neighbor: Map<Id<"users">, number>;
      combination: Map<string, number>;
      total: number;
    }
  >();

  for (const row of rows) {
    let studentStats = byStudent.get(row.studentUserId);
    if (!studentStats) {
      studentStats = emptyStudentHistory();
      byStudent.set(row.studentUserId, studentStats);
    }

    if (row.dimension === "total") {
      studentStats.total += row.count;
      continue;
    }
    if (row.dimension === "seat") {
      studentStats.seat.set(row.key, (studentStats.seat.get(row.key) ?? 0) + row.count);
      continue;
    }
    if (row.dimension === "zone") {
      studentStats.zone.set(row.key, (studentStats.zone.get(row.key) ?? 0) + row.count);
      continue;
    }
    if (row.dimension === "team") {
      studentStats.team.set(row.key, (studentStats.team.get(row.key) ?? 0) + row.count);
      continue;
    }
    if (row.dimension === "neighbor") {
      studentStats.neighbor.set(
        row.key as Id<"users">,
        (studentStats.neighbor.get(row.key as Id<"users">) ?? 0) + row.count,
      );
      continue;
    }
    if (row.dimension === "combination") {
      studentStats.combination.set(
        row.key,
        (studentStats.combination.get(row.key) ?? 0) + row.count,
      );
    }
  }

  return { byStudent };
}
