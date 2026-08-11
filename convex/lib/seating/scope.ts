import type { Id } from "../../_generated/dataModel.js";
import type { SeatingAlgorithmScope, SeatingScopeHint } from "./types.js";

export type GroupMembershipRow = {
  studentUserId: Id<"users">;
  groupId: Id<"groups">;
  teamId?: Id<"teams">;
};

export function inferSeatingScope(args: {
  explicit?: SeatingAlgorithmScope;
  hint?: SeatingScopeHint;
}): SeatingAlgorithmScope {
  if (args.explicit) return args.explicit;
  const teamIds = args.hint?.teamIds?.filter(Boolean) ?? [];
  if (teamIds.length > 0) {
    return { kind: "team", teamIds: [...teamIds] };
  }
  const groupIds = args.hint?.groupIds?.filter(Boolean) ?? [];
  if (groupIds.length > 0) {
    return { kind: "group", groupIds: [...groupIds] };
  }
  return { kind: "class" };
}

export function studentInSeatingScope(
  membership: GroupMembershipRow | undefined,
  scope: SeatingAlgorithmScope,
): boolean {
  if (!membership) return false;
  if (scope.kind === "class") return true;
  if (scope.kind === "group") {
    return scope.groupIds.includes(membership.groupId);
  }
  if (!membership.teamId) return false;
  return scope.teamIds.includes(membership.teamId);
}

export function movableStudentIds(args: {
  memberships: ReadonlyArray<GroupMembershipRow>;
  scope: SeatingAlgorithmScope;
  lockedStudentUserIds: ReadonlySet<Id<"users">>;
}): Array<Id<"users">> {
  const result: Array<Id<"users">> = [];
  for (const membership of args.memberships) {
    if (args.lockedStudentUserIds.has(membership.studentUserId)) continue;
    if (!studentInSeatingScope(membership, args.scope)) continue;
    result.push(membership.studentUserId);
  }
  return result;
}

export function groupIdsInScope(args: {
  memberships: ReadonlyArray<GroupMembershipRow>;
  scope: SeatingAlgorithmScope;
  lockedAssignments: ReadonlyArray<{ groupId: Id<"groups">; studentUserId: Id<"users"> }>;
}): Array<Id<"groups">> {
  const ids = new Set<Id<"groups">>();
  for (const membership of args.memberships) {
    if (!studentInSeatingScope(membership, args.scope)) continue;
    ids.add(membership.groupId);
  }
  for (const locked of args.lockedAssignments) {
    ids.add(locked.groupId);
  }
  return [...ids];
}

export function inferDefaultScopeFromClassShape(args: {
  memberships: ReadonlyArray<GroupMembershipRow>;
}): SeatingAlgorithmScope {
  const groupCounts = new Map<Id<"groups">, number>();
  for (const membership of args.memberships) {
    groupCounts.set(membership.groupId, (groupCounts.get(membership.groupId) ?? 0) + 1);
  }
  if (groupCounts.size <= 1) {
    return { kind: "class" };
  }
  return { kind: "class" };
}
