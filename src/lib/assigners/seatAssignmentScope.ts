import type { Id } from "../../../convex/_generated/dataModel";
import type { GroupTeamFilterState } from "@/lib/groups/groupTeamFilters";
import type { SeatChartCohortFilter } from "@/lib/assigners/seatCharts";
import { collectStudentsInGroup, type GroupsBoard } from "@/lib/groups/groups";

export type SeatAssignmentScopeKind = "class" | "group" | "team";

export type SeatAssignmentScope =
  | { kind: "class" }
  | { kind: "group"; groupIds: Array<Id<"groups">> }
  | { kind: "team"; teamIds: Array<Id<"teams">> };

export function inferSeatAssignmentScope(args: {
  cohort?: SeatChartCohortFilter;
  filterState: GroupTeamFilterState;
  explicit?: SeatAssignmentScope;
}): SeatAssignmentScope {
  if (args.explicit) return args.explicit;
  if (args.filterState.teamIds.length > 0) {
    return { kind: "team", teamIds: [...args.filterState.teamIds] as Array<Id<"teams">> };
  }
  if (args.filterState.groupIds.length > 0) {
    return { kind: "group", groupIds: [...args.filterState.groupIds] as Array<Id<"groups">> };
  }
  if (args.cohort === "team" && args.filterState.teamIds.length > 0) {
    return { kind: "team", teamIds: [...args.filterState.teamIds] as Array<Id<"teams">> };
  }
  if (args.cohort === "group" && args.filterState.groupIds.length > 0) {
    return { kind: "group", groupIds: [...args.filterState.groupIds] as Array<Id<"groups">> };
  }
  return { kind: "class" };
}

export function scopeToGenerateArgs(scope: SeatAssignmentScope): {
  scope: SeatAssignmentScope;
  groupIds?: Array<Id<"groups">>;
  teamIds?: Array<Id<"teams">>;
} {
  if (scope.kind === "group") {
    return { scope, groupIds: scope.groupIds };
  }
  if (scope.kind === "team") {
    return { scope, teamIds: scope.teamIds };
  }
  return { scope };
}

export function defaultAutoAssignChartName(layoutName: string): string {
  const date = new Date();
  const label = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `${layoutName} · ${label}`;
}

/** Human-readable labels for the active group/team filter (empty when none). */
export function resolveSeatAssignmentFilterLabels(args: {
  filterState: GroupTeamFilterState;
  board: GroupsBoard | undefined;
  ungroupedLabel: string;
}): string[] {
  const { filterState, board, ungroupedLabel } = args;
  if (filterState.teamIds.length > 0) {
    const teamNames = new Map<string, string>();
    for (const group of board?.groups ?? []) {
      for (const team of group.teams) {
        teamNames.set(team._id, team.name);
      }
    }
    return filterState.teamIds.map((id) => teamNames.get(id) ?? id);
  }
  const labels: string[] = [];
  if (filterState.groupIds.length > 0) {
    const groupNames = new Map(
      (board?.groups ?? []).map((group) => [group._id as string, group.name]),
    );
    for (const id of filterState.groupIds) {
      labels.push(groupNames.get(id) ?? id);
    }
  }
  if (filterState.includeUngrouped) {
    labels.push(ungroupedLabel);
  }
  return labels;
}

export function groupedStudentCount(board: GroupsBoard | undefined): number {
  if (!board) return 0;
  return board.groups.reduce((sum, group) => sum + collectStudentsInGroup(group).length, 0);
}
