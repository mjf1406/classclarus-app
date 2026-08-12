import type { Doc, Id } from "../_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "../_generated/server.js";
import { classScope } from "./authzModel.js";
import { getClassRoleForUser } from "./guardianLinks.js";
import { formatRosterNameParts, resolveRosterNameFormat } from "./rosterNameFormat.js";
import { seatHistoryKey, teamHistoryKey } from "./seating/historyKeys.js";
import {
  deskItemsById,
  findStrictDeskNeighborIds,
  slotKey,
  type ChartAssignment,
  type ChartAssignmentInput,
  type SeatLayoutItemSnapshot,
} from "./seatChartGeometry.js";

export {
  deskItemsById,
  findStrictDeskNeighborIds,
  slotKey,
  type ChartAssignment,
  type ChartAssignmentInput,
  type SeatLayoutItemSnapshot,
} from "./seatChartGeometry.js";

export const MAX_CHART_NAME_LENGTH = 80;
export const MAX_ASSIGNMENTS = 200;
export const DEFAULT_HISTORY_LIMIT = 20;
export const MAX_HISTORY_LIMIT = 100;

export type PlacementSnapshot = {
  studentUserId: Id<"users">;
  studentDisplayName: string;
  deskItemId: string;
  groupId: Id<"groups">;
  deskNumber?: number;
  zoneName?: string;
  teamKey?: string;
  teamLabel?: string;
  neighborStudentIds: Array<Id<"users">>;
  neighborDisplayNames: Array<string>;
  combinationKey: string;
};

export type ConstraintViolationParams = {
  student: string;
  other?: string;
  currentZone?: string;
  targetZone?: string;
  studentSeat?: string;
  otherSeat?: string;
  studentTeam?: string;
  otherTeam?: string;
};

export type ConstraintViolation = {
  constraintId: Id<"seatConstraints">;
  type: Doc<"seatConstraints">["type"];
  polarity: Doc<"seatConstraints">["polarity"];
  summary: string;
  studentUserIds: Array<Id<"users">>;
  params: ConstraintViolationParams;
};

function deskSeatParam(desk: SeatLayoutItemSnapshot | undefined): string | undefined {
  if (!desk) return undefined;
  if (desk.deskNumber !== undefined) return String(desk.deskNumber);
  const label = desk.label.trim();
  return label || undefined;
}

export function normalizeChartName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Name is required");
  }
  if (trimmed.length > MAX_CHART_NAME_LENGTH) {
    throw new Error(`Name must be at most ${MAX_CHART_NAME_LENGTH} characters`);
  }
  return trimmed;
}

export async function requireStudentInClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
  studentUserId: Id<"users">,
): Promise<void> {
  const role = await getClassRoleForUser(ctx, studentUserId, classScope(classId));
  if (role !== "student") {
    throw new Error("Person must be a student in this class");
  }
}

export async function resolveStudentDisplayName(
  ctx: QueryCtx | MutationCtx,
  classDoc: Doc<"classes">,
  studentUserId: Id<"users">,
): Promise<string> {
  const format = resolveRosterNameFormat(classDoc);
  const roster = await ctx.db
    .query("studentRosters")
    .withIndex("by_classId_userId", (q) =>
      q.eq("classId", classDoc._id).eq("userId", studentUserId),
    )
    .unique();
  const user = await ctx.db.get("users", studentUserId);
  const rosterName = formatRosterNameParts(roster?.firstName, roster?.lastName, format);
  return rosterName ?? user?.name?.trim() ?? user?.email?.trim() ?? studentUserId;
}

export async function normalizeDraftAssignments(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  assignments: Array<ChartAssignmentInput>,
  deskById: Map<string, SeatLayoutItemSnapshot>,
): Promise<Array<ChartAssignment>> {
  if (assignments.length > MAX_ASSIGNMENTS) {
    throw new Error(`At most ${MAX_ASSIGNMENTS} assignments allowed`);
  }

  const memberships = await loadMembershipByStudent(ctx, classId);
  const seenSlots = new Set<string>();
  const seenStudents = new Set<string>();
  const normalized: Array<ChartAssignment> = [];

  for (const assignment of assignments) {
    const deskItemId = assignment.deskItemId.trim();
    if (!deskItemId || !deskById.has(deskItemId)) {
      throw new Error("Invalid desk");
    }

    const membership = memberships.get(assignment.studentUserId);
    const groupId = assignment.groupId ?? membership?.groupId;
    if (!groupId) {
      throw new Error("Student must belong to a group before seating");
    }
    if (!membership || membership.groupId !== groupId) {
      throw new Error("Student must be seated in their group slot");
    }

    const key = slotKey(deskItemId, groupId);
    if (seenSlots.has(key)) {
      throw new Error("Each group slot on a desk can only have one student");
    }
    if (seenStudents.has(assignment.studentUserId)) {
      throw new Error("Each student can only have one seat");
    }

    seenSlots.add(key);
    seenStudents.add(assignment.studentUserId);
    normalized.push({
      deskItemId,
      groupId,
      studentUserId: assignment.studentUserId,
    });
  }

  return normalized;
}

export async function resolveTeamLabelForDesk(
  ctx: QueryCtx | MutationCtx,
  desk: SeatLayoutItemSnapshot,
): Promise<{ teamKey?: string; teamLabel?: string }> {
  const assignment = desk.teamAssignment;
  if (!assignment) return {};

  if (assignment.mode === "byName") {
    const teamName = assignment.teamName.trim();
    if (!teamName) return {};
    return {
      teamKey: teamHistoryKey(undefined, assignment),
      teamLabel: teamName,
    };
  }

  const group = await ctx.db.get("groups", assignment.groupId);
  const team = await ctx.db.get("teams", assignment.teamId);
  const groupName = group?.name?.trim() ?? "Group";
  const teamName = team?.name?.trim() ?? "Team";
  return {
    teamKey: teamHistoryKey(assignment.groupId, assignment),
    teamLabel: `${groupName} · ${teamName}`,
  };
}

export async function resolveTeamIdForStudentDesk(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"groups">,
  desk: SeatLayoutItemSnapshot,
): Promise<Id<"teams"> | undefined> {
  const assignment = desk.teamAssignment;
  if (!assignment) return undefined;

  if (assignment.mode === "single") {
    if (assignment.groupId !== groupId) return undefined;
    const team = await ctx.db.get("teams", assignment.teamId);
    if (!team || team.groupId !== groupId) return undefined;
    return assignment.teamId;
  }

  const teamName = assignment.teamName.trim();
  if (!teamName) return undefined;
  const target = teamName.toLowerCase();
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- teams per group are small
  const teams = await ctx.db
    .query("teams")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .collect();
  return teams.find((team) => team.name.trim().toLowerCase() === target)?._id;
}

export function deskTeamAssignmentAppliesToGroup(
  assignment: NonNullable<SeatLayoutItemSnapshot["teamAssignment"]>,
  groupId: Id<"groups">,
): boolean {
  if (assignment.mode === "byName") return true;
  return assignment.groupId === groupId;
}

export type UnresolvedDeskTeam = {
  deskItemId: string;
  deskNumber?: number;
  teamLabel: string;
  groupId: Id<"groups">;
};

export function formatUnresolvedDeskTeamError(unresolved: Array<UnresolvedDeskTeam>): string {
  const labels = [
    ...new Set(unresolved.map((entry) => entry.teamLabel.trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
  return `Desk team names do not match any team: ${labels.join(", ")}`;
}

export async function findUnresolvedDeskTeamAssignments(
  ctx: QueryCtx | MutationCtx,
  layout: Doc<"seatLayouts">,
  assignments: Array<ChartAssignment>,
): Promise<Array<UnresolvedDeskTeam>> {
  const deskById = deskItemsById(layout.items);
  const unresolved: Array<UnresolvedDeskTeam> = [];
  const seen = new Set<string>();

  for (const assignment of assignments) {
    const desk = deskById.get(assignment.deskItemId);
    const teamAssignment = desk?.teamAssignment;
    if (!desk || !teamAssignment) continue;
    if (!deskTeamAssignmentAppliesToGroup(teamAssignment, assignment.groupId)) continue;

    const teamId = await resolveTeamIdForStudentDesk(ctx, assignment.groupId, desk);
    if (teamId !== undefined) continue;

    const teamLabel = teamAssignment.mode === "byName" ? teamAssignment.teamName.trim() : "Team";
    const key = `${assignment.deskItemId}:${assignment.groupId}:${teamLabel.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    unresolved.push({
      deskItemId: assignment.deskItemId,
      deskNumber: desk.deskNumber,
      teamLabel,
      groupId: assignment.groupId,
    });
  }

  return unresolved;
}

export async function assertDeskTeamsResolvableForSeating(
  ctx: QueryCtx | MutationCtx,
  layout: Doc<"seatLayouts">,
  assignments: Array<ChartAssignment>,
): Promise<void> {
  const unresolved = await findUnresolvedDeskTeamAssignments(ctx, layout, assignments);
  if (unresolved.length > 0) {
    throw new Error(formatUnresolvedDeskTeamError(unresolved));
  }
}

export async function syncMembershipTeamsFromSeating(
  ctx: MutationCtx,
  classId: Id<"classes">,
  layout: Doc<"seatLayouts">,
  assignments: Array<ChartAssignment>,
): Promise<void> {
  const deskById = deskItemsById(layout.items);
  const now = Date.now();

  for (const assignment of assignments) {
    const desk = deskById.get(assignment.deskItemId);
    if (!desk) continue;

    const teamId = await resolveTeamIdForStudentDesk(ctx, assignment.groupId, desk);
    const membership = await ctx.db
      .query("groupMemberships")
      .withIndex("by_class_student", (q) =>
        q.eq("classId", classId).eq("studentUserId", assignment.studentUserId),
      )
      .unique();
    if (!membership || membership.groupId !== assignment.groupId) continue;

    if (teamId !== undefined) {
      await ctx.db.patch("groupMemberships", membership._id, {
        teamId,
        updatedAt: now,
      });
      continue;
    }

    if (membership.teamId === undefined) continue;

    const {
      _id: _ignoredId,
      _creationTime: _ignoredCreation,
      teamId: _ignoredTeamId,
      ...rest
    } = membership;
    await ctx.db.replace("groupMemberships", membership._id, {
      ...rest,
      updatedAt: now,
    });
  }
}

export function seatAggregateKey(layoutId: Id<"seatLayouts">, deskItemId: string): string {
  return seatHistoryKey(layoutId, deskItemId);
}

export function seatAggregateLabel(deskNumber: number | undefined): string {
  return deskNumber !== undefined ? `Seat ${deskNumber}` : "Seat";
}

export function buildCombinationKey(args: {
  layoutId: Id<"seatLayouts">;
  deskItemId: string;
  zoneName?: string;
  teamKey?: string;
  neighborStudentIds: Array<Id<"users">>;
}): string {
  const neighbors = [...args.neighborStudentIds].sort().join(",");
  return [
    `seat:${args.layoutId}:${args.deskItemId}`,
    `zone:${args.zoneName ?? ""}`,
    `team:${args.teamKey ?? ""}`,
    `neighbors:${neighbors}`,
  ].join("|");
}

/** Spatial neighbors on adjacent desks, limited to the seated student's group. */
export function sameGroupNeighborStudentIds(
  seatedStudentGroupId: Id<"groups">,
  neighborDeskIds: Array<string>,
  studentsByDesk: Map<string, Array<Id<"users">>>,
  groupIdByStudent: Map<Id<"users">, Id<"groups">>,
): Array<Id<"users">> {
  return neighborDeskIds.flatMap((deskId) =>
    (studentsByDesk.get(deskId) ?? []).filter(
      (studentId) => groupIdByStudent.get(studentId) === seatedStudentGroupId,
    ),
  );
}

export async function buildPlacementSnapshots(
  ctx: QueryCtx | MutationCtx,
  classDoc: Doc<"classes">,
  layout: Doc<"seatLayouts">,
  assignments: Array<ChartAssignment>,
): Promise<Array<PlacementSnapshot>> {
  const deskById = deskItemsById(layout.items);
  const neighborMap = findStrictDeskNeighborIds(layout.items);
  const groupIdByStudent = new Map(assignments.map((a) => [a.studentUserId, a.groupId]));
  const studentsByDesk = new Map<string, Array<Id<"users">>>();
  for (const assignment of assignments) {
    const list = studentsByDesk.get(assignment.deskItemId) ?? [];
    list.push(assignment.studentUserId);
    studentsByDesk.set(assignment.deskItemId, list);
  }

  const placements: Array<PlacementSnapshot> = [];

  for (const assignment of assignments) {
    const desk = deskById.get(assignment.deskItemId);
    if (!desk) continue;

    const neighborDeskIds = neighborMap.get(assignment.deskItemId) ?? [];
    const neighborStudentIds = sameGroupNeighborStudentIds(
      assignment.groupId,
      neighborDeskIds,
      studentsByDesk,
      groupIdByStudent,
    );

    const neighborDisplayNames = await Promise.all(
      neighborStudentIds.map((id) => resolveStudentDisplayName(ctx, classDoc, id)),
    );

    const resolvedTeam = await resolveTeamLabelForDesk(ctx, desk);
    const teamApplies =
      !desk.teamAssignment ||
      deskTeamAssignmentAppliesToGroup(desk.teamAssignment, assignment.groupId);
    const teamKey = teamApplies ? resolvedTeam.teamKey : undefined;
    const teamLabel = teamApplies ? resolvedTeam.teamLabel : undefined;
    const zoneName = desk.zoneName?.trim() || undefined;
    const studentDisplayName = await resolveStudentDisplayName(
      ctx,
      classDoc,
      assignment.studentUserId,
    );

    placements.push({
      studentUserId: assignment.studentUserId,
      studentDisplayName,
      deskItemId: assignment.deskItemId,
      groupId: assignment.groupId,
      ...(desk.deskNumber !== undefined ? { deskNumber: desk.deskNumber } : {}),
      ...(zoneName !== undefined ? { zoneName } : {}),
      ...(teamKey !== undefined ? { teamKey } : {}),
      ...(teamLabel !== undefined ? { teamLabel } : {}),
      neighborStudentIds,
      neighborDisplayNames,
      combinationKey: buildCombinationKey({
        layoutId: layout._id,
        deskItemId: assignment.deskItemId,
        zoneName,
        teamKey,
        neighborStudentIds,
      }),
    });
  }

  return placements;
}

async function loadMembershipByStudent(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
): Promise<Map<Id<"users">, { groupId: Id<"groups">; teamId?: Id<"teams"> }>> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class-bounded memberships
  const memberships = await ctx.db
    .query("groupMemberships")
    .withIndex("by_class", (q) => q.eq("classId", classId))
    .collect();
  const map = new Map<Id<"users">, { groupId: Id<"groups">; teamId?: Id<"teams"> }>();
  for (const membership of memberships) {
    map.set(membership.studentUserId, {
      groupId: membership.groupId,
      ...(membership.teamId !== undefined ? { teamId: membership.teamId } : {}),
    });
  }
  return map;
}

export function areDeskTeammates(
  studentA: Id<"users">,
  studentB: Id<"users">,
  assignmentByStudent: Map<Id<"users">, string>,
  teamKeyByDesk: Map<string, string | undefined>,
  groupIdByStudent: Map<Id<"users">, Id<"groups">>,
): boolean {
  const groupA = groupIdByStudent.get(studentA);
  const groupB = groupIdByStudent.get(studentB);
  if (!groupA || !groupB || groupA !== groupB) return false;

  const deskA = assignmentByStudent.get(studentA);
  const deskB = assignmentByStudent.get(studentB);
  if (!deskA || !deskB || deskA === deskB) return false;

  const keyA = teamKeyByDesk.get(slotKey(deskA, groupA));
  const keyB = teamKeyByDesk.get(slotKey(deskB, groupB));
  if (!keyA || !keyB) return false;
  return keyA === keyB;
}

function areSpatialNeighbors(
  deskA: string | undefined,
  deskB: string | undefined,
  neighborMap: Map<string, Array<string>>,
): boolean {
  if (!deskA || !deskB || deskA === deskB) return false;
  return (neighborMap.get(deskA) ?? []).includes(deskB);
}

export async function evaluateConstraintViolations(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  layoutItems: Array<SeatLayoutItemSnapshot>,
  assignments: Array<ChartAssignment>,
  studentName: (userId: Id<"users">) => string,
): Promise<Array<ConstraintViolation>> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class-bounded constraints
  const constraints = await ctx.db
    .query("seatConstraints")
    .withIndex("by_class", (q) => q.eq("classId", classId))
    .collect();

  const assignmentByStudent = new Map(assignments.map((a) => [a.studentUserId, a.deskItemId]));
  const groupIdByStudent = new Map(assignments.map((a) => [a.studentUserId, a.groupId]));
  const deskById = deskItemsById(layoutItems);
  const neighborMap = findStrictDeskNeighborIds(layoutItems);
  const memberships = await loadMembershipByStudent(ctx, classId);

  for (const [studentUserId, membership] of memberships) {
    if (!groupIdByStudent.has(studentUserId)) {
      groupIdByStudent.set(studentUserId, membership.groupId);
    }
  }

  const teamKeyByDesk = new Map<string, string | undefined>();
  const teamLabelByDesk = new Map<string, string | undefined>();
  for (const desk of deskById.values()) {
    const { teamKey, teamLabel } = await resolveTeamLabelForDesk(ctx, desk);
    teamLabelByDesk.set(desk.id, teamLabel);
    for (const membership of memberships.values()) {
      teamKeyByDesk.set(
        slotKey(desk.id, membership.groupId),
        desk.teamAssignment ? teamHistoryKey(membership.groupId, desk.teamAssignment) : teamKey,
      );
    }
  }

  const violations: Array<ConstraintViolation> = [];

  for (const constraint of constraints) {
    const studentDesk = assignmentByStudent.get(constraint.studentUserId);
    const studentLabel = studentName(constraint.studentUserId);

    if (constraint.type === "zone") {
      if (!studentDesk) continue;
      const desk = deskById.get(studentDesk);
      const zone = desk?.zoneName?.trim() ?? "";
      const target = constraint.zoneName?.trim() ?? "";
      const inZone = zone === target;
      const violated =
        constraint.polarity === "must" ? !inZone : constraint.polarity === "mustNot" && inZone;
      if (violated) {
        violations.push({
          constraintId: constraint._id,
          type: constraint.type,
          polarity: constraint.polarity,
          summary: `${studentLabel} / ${target}`,
          studentUserIds: [constraint.studentUserId],
          params: {
            student: studentLabel,
            ...(zone ? { currentZone: zone } : {}),
            ...(target ? { targetZone: target } : {}),
          },
        });
      }
      continue;
    }

    const otherId = constraint.otherStudentUserId;
    if (!otherId) continue;
    const otherDesk = assignmentByStudent.get(otherId);
    const otherLabel = studentName(otherId);
    const involved = [constraint.studentUserId, otherId];
    const studentSeat = deskSeatParam(studentDesk ? deskById.get(studentDesk) : undefined);
    const otherSeat = deskSeatParam(otherDesk ? deskById.get(otherDesk) : undefined);

    if (constraint.type === "neighbor") {
      const adjacent = areSpatialNeighbors(studentDesk, otherDesk, neighborMap);
      const violated =
        constraint.polarity === "must" ? !adjacent : constraint.polarity === "mustNot" && adjacent;
      if (violated) {
        violations.push({
          constraintId: constraint._id,
          type: constraint.type,
          polarity: constraint.polarity,
          summary: `${studentLabel} / ${otherLabel}`,
          studentUserIds: involved,
          params: {
            student: studentLabel,
            other: otherLabel,
            ...(studentSeat ? { studentSeat } : {}),
            ...(otherSeat ? { otherSeat } : {}),
          },
        });
      }
      continue;
    }

    const teammates = areDeskTeammates(
      constraint.studentUserId,
      otherId,
      assignmentByStudent,
      teamKeyByDesk,
      groupIdByStudent,
    );
    const violated =
      constraint.polarity === "must" ? !teammates : constraint.polarity === "mustNot" && teammates;
    if (violated) {
      const studentTeam = studentDesk ? teamLabelByDesk.get(studentDesk) : undefined;
      const otherTeam = otherDesk ? teamLabelByDesk.get(otherDesk) : undefined;
      violations.push({
        constraintId: constraint._id,
        type: constraint.type,
        polarity: constraint.polarity,
        summary: `${studentLabel} / ${otherLabel}`,
        studentUserIds: involved,
        params: {
          student: studentLabel,
          other: otherLabel,
          ...(studentTeam ? { studentTeam } : {}),
          ...(otherTeam ? { otherTeam } : {}),
        },
      });
    }
  }

  return violations;
}

export async function incrementAggregate(
  ctx: MutationCtx,
  args: {
    classId: Id<"classes">;
    chartId: Id<"seatCharts">;
    studentUserId: Id<"users">;
    dimension: Doc<"seatChartAggregates">["dimension"];
    key: string;
    label: string;
    now: number;
  },
): Promise<void> {
  const existing = await ctx.db
    .query("seatChartAggregates")
    .withIndex("by_chart_student_dimension_key", (q) =>
      q
        .eq("chartId", args.chartId)
        .eq("studentUserId", args.studentUserId)
        .eq("dimension", args.dimension)
        .eq("key", args.key),
    )
    .unique();

  if (existing) {
    await ctx.db.patch("seatChartAggregates", existing._id, {
      count: existing.count + 1,
      label: args.label,
      updatedAt: args.now,
    });
    return;
  }

  await ctx.db.insert("seatChartAggregates", {
    classId: args.classId,
    chartId: args.chartId,
    studentUserId: args.studentUserId,
    dimension: args.dimension,
    key: args.key,
    label: args.label,
    count: 1,
    updatedAt: args.now,
  });
}

export async function incrementLayoutAggregate(
  ctx: MutationCtx,
  args: {
    classId: Id<"classes">;
    layoutId: Id<"seatLayouts">;
    studentUserId: Id<"users">;
    dimension: Doc<"seatLayoutAggregates">["dimension"];
    key: string;
    label: string;
    now: number;
  },
): Promise<void> {
  const existing = await ctx.db
    .query("seatLayoutAggregates")
    .withIndex("by_layout_student_dimension_key", (q) =>
      q
        .eq("layoutId", args.layoutId)
        .eq("studentUserId", args.studentUserId)
        .eq("dimension", args.dimension)
        .eq("key", args.key),
    )
    .unique();

  if (existing) {
    await ctx.db.patch("seatLayoutAggregates", existing._id, {
      count: existing.count + 1,
      label: args.label,
      updatedAt: args.now,
    });
    return;
  }

  await ctx.db.insert("seatLayoutAggregates", {
    classId: args.classId,
    layoutId: args.layoutId,
    studentUserId: args.studentUserId,
    dimension: args.dimension,
    key: args.key,
    label: args.label,
    count: 1,
    updatedAt: args.now,
  });
}

export async function applyLayoutPlacementAggregates(
  ctx: MutationCtx,
  args: {
    classId: Id<"classes">;
    layoutId: Id<"seatLayouts">;
    placement: PlacementSnapshot;
    now: number;
  },
): Promise<void> {
  const { classId, layoutId, placement, now } = args;
  const studentUserId = placement.studentUserId;

  await incrementLayoutAggregate(ctx, {
    classId,
    layoutId,
    studentUserId,
    dimension: "total",
    key: "total",
    label: "",
    now,
  });

  await incrementLayoutAggregate(ctx, {
    classId,
    layoutId,
    studentUserId,
    dimension: "seat",
    key: seatAggregateKey(layoutId, placement.deskItemId),
    label: seatAggregateLabel(placement.deskNumber),
    now,
  });

  if (placement.zoneName) {
    await incrementLayoutAggregate(ctx, {
      classId,
      layoutId,
      studentUserId,
      dimension: "zone",
      key: placement.zoneName,
      label: placement.zoneName,
      now,
    });
  }

  if (placement.teamKey && placement.teamLabel) {
    await incrementLayoutAggregate(ctx, {
      classId,
      layoutId,
      studentUserId,
      dimension: "team",
      key: placement.teamKey,
      label: placement.teamLabel,
      now,
    });
  }

  for (let i = 0; i < placement.neighborStudentIds.length; i += 1) {
    const neighborId = placement.neighborStudentIds[i];
    const neighborLabel = placement.neighborDisplayNames[i] ?? neighborId;
    if (!neighborId) continue;
    await incrementLayoutAggregate(ctx, {
      classId,
      layoutId,
      studentUserId,
      dimension: "neighbor",
      key: neighborId,
      label: neighborLabel,
      now,
    });
  }

  await incrementLayoutAggregate(ctx, {
    classId,
    layoutId,
    studentUserId,
    dimension: "combination",
    key: placement.combinationKey,
    label: buildCombinationLabel(placement),
    now,
  });
}

export async function applyPlacementAggregates(
  ctx: MutationCtx,
  args: {
    classId: Id<"classes">;
    chartId: Id<"seatCharts">;
    layoutId: Id<"seatLayouts">;
    placement: PlacementSnapshot;
    now: number;
  },
): Promise<void> {
  const { classId, chartId, layoutId, placement, now } = args;
  const studentUserId = placement.studentUserId;

  await incrementAggregate(ctx, {
    classId,
    chartId,
    studentUserId,
    dimension: "total",
    key: "total",
    label: "",
    now,
  });

  await incrementAggregate(ctx, {
    classId,
    chartId,
    studentUserId,
    dimension: "seat",
    key: seatAggregateKey(layoutId, placement.deskItemId),
    label: seatAggregateLabel(placement.deskNumber),
    now,
  });

  if (placement.zoneName) {
    await incrementAggregate(ctx, {
      classId,
      chartId,
      studentUserId,
      dimension: "zone",
      key: placement.zoneName,
      label: placement.zoneName,
      now,
    });
  }

  if (placement.teamKey && placement.teamLabel) {
    await incrementAggregate(ctx, {
      classId,
      chartId,
      studentUserId,
      dimension: "team",
      key: placement.teamKey,
      label: placement.teamLabel,
      now,
    });
  }

  for (let i = 0; i < placement.neighborStudentIds.length; i += 1) {
    const neighborId = placement.neighborStudentIds[i];
    const neighborLabel = placement.neighborDisplayNames[i] ?? neighborId;
    if (!neighborId) continue;
    await incrementAggregate(ctx, {
      classId,
      chartId,
      studentUserId,
      dimension: "neighbor",
      key: neighborId,
      label: neighborLabel,
      now,
    });
  }

  await incrementAggregate(ctx, {
    classId,
    chartId,
    studentUserId,
    dimension: "combination",
    key: placement.combinationKey,
    label: buildCombinationLabel(placement),
    now,
  });

  await applyLayoutPlacementAggregates(ctx, {
    classId,
    layoutId,
    placement,
    now,
  });
}

export function buildCombinationLabel(placement: PlacementSnapshot): string {
  const parts = [seatAggregateLabel(placement.deskNumber)];
  if (placement.zoneName) parts.push(placement.zoneName);
  if (placement.teamLabel) parts.push(placement.teamLabel);
  if (placement.neighborDisplayNames.length > 0) {
    parts.push(placement.neighborDisplayNames.join(", "));
  }
  return parts.join(" · ");
}

export type MergedAggregateRow = {
  dimension: Doc<"seatChartAggregates">["dimension"];
  key: string;
  label: string;
  count: number;
};

export function mergeAggregateRows(
  rows: Array<Pick<Doc<"seatChartAggregates">, "dimension" | "key" | "label" | "count">>,
): Array<MergedAggregateRow> {
  const merged = new Map<string, MergedAggregateRow>();
  for (const row of rows) {
    const mapKey = `${row.dimension}:${row.key}`;
    const existing = merged.get(mapKey);
    if (existing) {
      existing.count += row.count;
    } else {
      merged.set(mapKey, {
        dimension: row.dimension,
        key: row.key,
        label: row.label,
        count: row.count,
      });
    }
  }
  return [...merged.values()];
}

export async function chartsForLayout(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  layoutId: Id<"seatLayouts">,
): Promise<Array<Doc<"seatCharts">>> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- layout-bounded chart list
  return await ctx.db
    .query("seatCharts")
    .withIndex("by_class_layout", (q) => q.eq("classId", classId).eq("layoutId", layoutId))
    .collect();
}

export async function activeChartsForLayout(
  ctx: QueryCtx | MutationCtx,
  layoutId: Id<"seatLayouts">,
): Promise<Array<Doc<"seatCharts">>> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- layout-bounded chart list
  const charts = await ctx.db
    .query("seatCharts")
    .withIndex("by_layout", (q) => q.eq("layoutId", layoutId))
    .collect();
  return charts.filter((chart) => chart.archivedAt === undefined);
}
