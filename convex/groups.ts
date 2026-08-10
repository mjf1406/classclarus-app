import { v } from "convex/values";

import { APP_CONFIG } from "./appConfig.js";
import { components } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { recordClassActivity } from "./lib/classActivity.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import { getClassRoleForUser } from "./lib/guardianLinks.js";
import { rateLimiter } from "./lib/rateLimiter.js";
import {
  formatRosterNameParts,
  resolveRosterNameFormat,
  type RosterNameFormat,
} from "./lib/rosterNameFormat.js";
import { resolveUserImageUrl } from "./lib/userImage.js";

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_ICON_LENGTH = 64;
const MAX_BULK_ASSIGN_STUDENTS = 100;

const boardStudentValidator = v.object({
  userId: v.id("users"),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  email: v.optional(v.string()),
});

const boardTeamValidator = v.object({
  _id: v.id("teams"),
  groupId: v.id("groups"),
  name: v.string(),
  description: v.optional(v.string()),
  icon: v.optional(v.string()),
  imageFileId: v.optional(v.id("files")),
  updatedAt: v.number(),
  students: v.array(boardStudentValidator),
});

const boardGroupValidator = v.object({
  _id: v.id("groups"),
  name: v.string(),
  description: v.optional(v.string()),
  icon: v.optional(v.string()),
  imageFileId: v.optional(v.id("files")),
  updatedAt: v.number(),
  /** Students in the group with no team. */
  students: v.array(boardStudentValidator),
  teams: v.array(boardTeamValidator),
});

const boardValidator = v.object({
  groups: v.array(boardGroupValidator),
  ungrouped: v.array(boardStudentValidator),
});

type BoardStudent = {
  userId: Id<"users">;
  firstName?: string;
  lastName?: string;
  name?: string;
  image?: string;
  email?: string;
};

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Name is required");
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new Error(`Name must be at most ${MAX_NAME_LENGTH} characters`);
  }
  return trimmed;
}

function normalizeOptionalDescription(description: string | undefined): string | undefined {
  if (description === undefined) return undefined;
  const trimmed = description.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
  }
  return trimmed;
}

function normalizeOptionalIcon(icon: string | undefined): string | undefined {
  if (icon === undefined) return undefined;
  const trimmed = icon.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_ICON_LENGTH) {
    throw new Error(`Icon must be at most ${MAX_ICON_LENGTH} characters`);
  }
  return trimmed;
}

async function requireClassImageFile(
  ctx: MutationCtx,
  classId: Id<"classes">,
  fileId: Id<"files">,
): Promise<{ name: string }> {
  const file = await ctx.db.get("files", fileId);
  // Uniform deny for missing vs wrong-class — avoid existence oracle.
  if (!file || file.classId !== classId) {
    throw new Error("File not found or access denied");
  }
  if (file.preset !== "images") {
    throw new Error("Image must be an image upload");
  }
  return { name: file.name };
}

function rosterDisplaySortKey(student: BoardStudent, format: RosterNameFormat): string {
  const rosterName = formatRosterNameParts(student.firstName, student.lastName, format);
  return (rosterName ?? student.name ?? student.email ?? student.userId).toLocaleLowerCase();
}

async function loadBoardStudent(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  roster?: { firstName?: string; lastName?: string } | null,
): Promise<BoardStudent | null> {
  const user = await ctx.db.get("users", userId);
  if (!user) return null;
  return {
    userId: user._id,
    ...(roster?.firstName !== undefined ? { firstName: roster.firstName } : {}),
    ...(roster?.lastName !== undefined ? { lastName: roster.lastName } : {}),
    name: user.name,
    image: await resolveUserImageUrl(ctx, user),
    email: user.email,
  };
}

function sortStudents(
  students: Array<BoardStudent>,
  format: RosterNameFormat,
): Array<BoardStudent> {
  return [...students].sort((a, b) =>
    rosterDisplaySortKey(a, format).localeCompare(rosterDisplaySortKey(b, format)),
  );
}

/**
 * Full groups/teams board for a class: groups with nested teams, memberships,
 * and the ungrouped student pool.
 */
export const board = classQuery({
  args: {},
  returns: boardValidator,
  handler: async (ctx) => {
    const classId = ctx.classDoc._id;
    const nameFormat = resolveRosterNameFormat(ctx.classDoc);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded board
    const groupDocs = await ctx.db
      .query("groups")
      .withIndex("by_class", (q) => q.eq("classId", classId))
      .collect();
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded board
    const teamDocs = await ctx.db
      .query("teams")
      .withIndex("by_class", (q) => q.eq("classId", classId))
      .collect();
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded board
    const membershipDocs = await ctx.db
      .query("groupMemberships")
      .withIndex("by_class", (q) => q.eq("classId", classId))
      .collect();

    const studentEntries = await ctx.runQuery(components.authz.queries.getUsersWithRole, {
      tenantId: APP_CONFIG.authzTenantId,
      role: "student",
      scope: ctx.scope,
    });
    const studentIds = studentEntries.map(
      (entry: { userId: string }) => entry.userId as Id<"users">,
    );

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded roster
    const rosterRows = await ctx.db
      .query("studentRosters")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();
    const rosterByUserId = new Map(
      rosterRows.map(
        (row) => [row.userId, { firstName: row.firstName, lastName: row.lastName }] as const,
      ),
    );

    const studentById = new Map<string, BoardStudent>();
    for (const userId of studentIds) {
      const student = await loadBoardStudent(ctx, userId, rosterByUserId.get(userId));
      if (student) studentById.set(userId, student);
    }

    const groupedStudentIds = new Set<string>();
    const groupOnlyByGroup = new Map<string, Array<BoardStudent>>();
    const teamStudents = new Map<string, Array<BoardStudent>>();

    for (const membership of membershipDocs) {
      const student = studentById.get(membership.studentUserId);
      if (!student) continue;
      groupedStudentIds.add(membership.studentUserId);
      if (membership.teamId) {
        const list = teamStudents.get(membership.teamId) ?? [];
        list.push(student);
        teamStudents.set(membership.teamId, list);
      } else {
        const list = groupOnlyByGroup.get(membership.groupId) ?? [];
        list.push(student);
        groupOnlyByGroup.set(membership.groupId, list);
      }
    }

    const teamsByGroup = new Map<string, typeof teamDocs>();
    for (const team of teamDocs) {
      const list = teamsByGroup.get(team.groupId) ?? [];
      list.push(team);
      teamsByGroup.set(team.groupId, list);
    }

    const groups = groupDocs
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((group) => {
        const teams = (teamsByGroup.get(group._id) ?? [])
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((team) => ({
            _id: team._id,
            groupId: team.groupId,
            name: team.name,
            description: team.description,
            icon: team.icon,
            imageFileId: team.imageFileId,
            updatedAt: team.updatedAt,
            students: sortStudents(teamStudents.get(team._id) ?? [], nameFormat),
          }));
        return {
          _id: group._id,
          name: group.name,
          description: group.description,
          icon: group.icon,
          imageFileId: group.imageFileId,
          updatedAt: group.updatedAt,
          students: sortStudents(groupOnlyByGroup.get(group._id) ?? [], nameFormat),
          teams,
        };
      });

    const ungrouped = sortStudents(
      studentIds
        .filter((userId) => !groupedStudentIds.has(userId))
        .map((userId) => studentById.get(userId))
        .filter((student): student is BoardStudent => student !== undefined),
      nameFormat,
    );

    return { groups, ungrouped };
  },
});

export const createGroup = classMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    imageFileId: v.optional(v.id("files")),
  },
  returns: v.id("groups"),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "groupCreate", { key: ctx.userId, throws: true });
    await ctx.require("groups:manage");

    const now = Date.now();
    const name = normalizeName(args.name);
    const description = normalizeOptionalDescription(args.description);
    const icon = normalizeOptionalIcon(args.icon);
    if (args.imageFileId !== undefined) {
      await requireClassImageFile(ctx, ctx.classDoc._id, args.imageFileId);
    }

    const groupId = await ctx.db.insert("groups", {
      classId: ctx.classDoc._id,
      name,
      ...(description !== undefined ? { description } : {}),
      ...(icon !== undefined ? { icon } : {}),
      ...(args.imageFileId !== undefined ? { imageFileId: args.imageFileId } : {}),
      updatedAt: now,
    });

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "group",
      resourceId: groupId,
      summary: `Created group “${name}”`,
      summaryKey: "activitySummary_createdGroup",
      metadata: { name },
    });

    return groupId;
  },
});

export const updateGroup = classMutation({
  args: {
    groupId: v.id("groups"),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "groupUpdate", { key: ctx.userId, throws: true });
    await ctx.require("groups:manage");

    const group = await ctx.db.get("groups", args.groupId);
    if (!group || group.classId !== ctx.classDoc._id) {
      throw new Error("Group not found");
    }

    const name = normalizeName(args.name);
    const description = normalizeOptionalDescription(args.description);
    const icon = normalizeOptionalIcon(args.icon);

    await ctx.db.patch("groups", args.groupId, {
      name,
      description,
      icon,
      updatedAt: Date.now(),
    });

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "group",
      resourceId: args.groupId,
      summary: `Updated group “${name}”`,
      summaryKey: "activitySummary_updatedGroup",
      metadata: { name },
    });

    return null;
  },
});

export const setGroupImage = classMutation({
  args: {
    groupId: v.id("groups"),
    fileId: v.id("files"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "groupUpdate", { key: ctx.userId, throws: true });
    await ctx.require("groups:manage");

    const group = await ctx.db.get("groups", args.groupId);
    if (!group || group.classId !== ctx.classDoc._id) {
      throw new Error("Group not found");
    }

    const file = await requireClassImageFile(ctx, ctx.classDoc._id, args.fileId);
    await ctx.db.patch("groups", args.groupId, {
      imageFileId: args.fileId,
      updatedAt: Date.now(),
    });

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "group",
      resourceId: args.groupId,
      summary: `Set image for group “${group.name}”`,
      summaryKey: "activitySummary_setGroupImage",
      metadata: { name: group.name, fileId: args.fileId, fileName: file.name },
    });

    return null;
  },
});

export const clearGroupImage = classMutation({
  args: {
    groupId: v.id("groups"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "groupUpdate", { key: ctx.userId, throws: true });
    await ctx.require("groups:manage");

    const group = await ctx.db.get("groups", args.groupId);
    if (!group || group.classId !== ctx.classDoc._id) {
      throw new Error("Group not found");
    }

    await ctx.db.patch("groups", args.groupId, {
      imageFileId: undefined,
      updatedAt: Date.now(),
    });

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "group",
      resourceId: args.groupId,
      summary: `Cleared image for group “${group.name}”`,
      summaryKey: "activitySummary_clearedGroupImage",
      metadata: { name: group.name },
    });

    return null;
  },
});

export const removeGroup = classMutation({
  args: {
    groupId: v.id("groups"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "groupRemove", { key: ctx.userId, throws: true });
    await ctx.require("groups:manage");

    const group = await ctx.db.get("groups", args.groupId);
    if (!group || group.classId !== ctx.classDoc._id) {
      throw new Error("Group not found");
    }

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded cascade
    const memberships = await ctx.db
      .query("groupMemberships")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();
    for (const membership of memberships) {
      await ctx.db.delete("groupMemberships", membership._id);
    }

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded cascade
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();
    for (const team of teams) {
      await ctx.db.delete("teams", team._id);
    }

    await ctx.db.delete("groups", args.groupId);

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "group",
      resourceId: args.groupId,
      summary: `Deleted group “${group.name}”`,
      summaryKey: "activitySummary_deletedGroup",
      metadata: { name: group.name },
    });

    return null;
  },
});

export const createTeam = classMutation({
  args: {
    groupId: v.id("groups"),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    imageFileId: v.optional(v.id("files")),
    /** Also create the same team in these other groups (same class). */
    alsoCreateInGroupIds: v.optional(v.array(v.id("groups"))),
  },
  returns: v.id("teams"),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "teamCreate", { key: ctx.userId, throws: true });
    await ctx.require("groups:manage");

    const group = await ctx.db.get("groups", args.groupId);
    if (!group || group.classId !== ctx.classDoc._id) {
      throw new Error("Group not found");
    }

    const now = Date.now();
    const name = normalizeName(args.name);
    const description = normalizeOptionalDescription(args.description);
    const icon = normalizeOptionalIcon(args.icon);
    const classId = ctx.classDoc._id;
    if (args.imageFileId !== undefined) {
      await requireClassImageFile(ctx, classId, args.imageFileId);
    }

    const teamId = await ctx.db.insert("teams", {
      classId,
      groupId: args.groupId,
      name,
      ...(description !== undefined ? { description } : {}),
      ...(icon !== undefined ? { icon } : {}),
      ...(args.imageFileId !== undefined ? { imageFileId: args.imageFileId } : {}),
      updatedAt: now,
    });

    const extraGroupIds = [...new Set(args.alsoCreateInGroupIds ?? [])].filter(
      (id) => id !== args.groupId,
    );
    let createdCount = 1;

    if (extraGroupIds.length > 0) {
      // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded
      const existingTeams = await ctx.db
        .query("teams")
        .withIndex("by_class", (q) => q.eq("classId", classId))
        .collect();
      const nameKey = name.toLocaleLowerCase();
      const groupsWithName = new Set(
        existingTeams
          .filter((team) => team.name.toLocaleLowerCase() === nameKey)
          .map((team) => team.groupId),
      );

      for (const otherGroupId of extraGroupIds) {
        const other = await ctx.db.get("groups", otherGroupId);
        if (!other || other.classId !== classId) {
          throw new Error("Group not found");
        }
        if (groupsWithName.has(otherGroupId)) continue;
        await ctx.db.insert("teams", {
          classId,
          groupId: otherGroupId,
          name,
          ...(description !== undefined ? { description } : {}),
          ...(icon !== undefined ? { icon } : {}),
          ...(args.imageFileId !== undefined ? { imageFileId: args.imageFileId } : {}),
          updatedAt: now,
        });
        createdCount += 1;
      }
    }

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "team",
      resourceId: teamId,
      summary:
        createdCount > 1
          ? `Created team “${name}” in ${createdCount} groups`
          : `Created team “${name}”`,
      summaryKey:
        createdCount > 1 ? "activitySummary_createdTeamInGroups" : "activitySummary_createdTeam",
      metadata: {
        name,
        groupId: args.groupId,
        ...(createdCount > 1
          ? { count: String(createdCount), createdCount: String(createdCount) }
          : {}),
      },
    });

    return teamId;
  },
});

/**
 * Copy a team's name/description/icon/image into other groups. Does not copy students.
 */
export const copyTeam = classMutation({
  args: {
    teamId: v.id("teams"),
    targetGroupIds: v.array(v.id("groups")),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "teamCreate", { key: ctx.userId, throws: true });
    await ctx.require("groups:manage");

    const source = await ctx.db.get("teams", args.teamId);
    if (!source || source.classId !== ctx.classDoc._id) {
      throw new Error("Team not found");
    }

    const targetGroupIds = [...new Set(args.targetGroupIds)].filter((id) => id !== source.groupId);
    if (targetGroupIds.length === 0) {
      throw new Error("Select at least one group");
    }

    const classId = ctx.classDoc._id;
    const nameKey = source.name.toLocaleLowerCase();
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded
    const existingTeams = await ctx.db
      .query("teams")
      .withIndex("by_class", (q) => q.eq("classId", classId))
      .collect();
    const groupsWithName = new Set(
      existingTeams
        .filter((team) => team.name.toLocaleLowerCase() === nameKey)
        .map((team) => team.groupId),
    );

    const now = Date.now();
    let createdCount = 0;
    for (const targetGroupId of targetGroupIds) {
      const target = await ctx.db.get("groups", targetGroupId);
      if (!target || target.classId !== classId) {
        throw new Error("Group not found");
      }
      if (groupsWithName.has(targetGroupId)) continue;
      await ctx.db.insert("teams", {
        classId,
        groupId: targetGroupId,
        name: source.name,
        ...(source.description !== undefined ? { description: source.description } : {}),
        ...(source.icon !== undefined ? { icon: source.icon } : {}),
        ...(source.imageFileId !== undefined ? { imageFileId: source.imageFileId } : {}),
        updatedAt: now,
      });
      createdCount += 1;
    }

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "team",
      resourceId: args.teamId,
      summary:
        createdCount === 1
          ? `Copied team “${source.name}” to another group`
          : `Copied team “${source.name}” to ${createdCount} groups`,
      summaryKey:
        createdCount === 1
          ? "activitySummary_copiedTeamToGroup"
          : "activitySummary_copiedTeamToGroups",
      metadata: {
        name: source.name,
        sourceGroupId: source.groupId,
        count: String(createdCount),
        createdCount: String(createdCount),
      },
    });

    return createdCount;
  },
});

export const updateTeam = classMutation({
  args: {
    teamId: v.id("teams"),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "teamUpdate", { key: ctx.userId, throws: true });
    await ctx.require("groups:manage");

    const team = await ctx.db.get("teams", args.teamId);
    if (!team || team.classId !== ctx.classDoc._id) {
      throw new Error("Team not found");
    }

    const name = normalizeName(args.name);
    const description = normalizeOptionalDescription(args.description);
    const icon = normalizeOptionalIcon(args.icon);

    await ctx.db.patch("teams", args.teamId, {
      name,
      description,
      icon,
      updatedAt: Date.now(),
    });

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "team",
      resourceId: args.teamId,
      summary: `Updated team “${name}”`,
      summaryKey: "activitySummary_updatedTeam",
      metadata: { name, groupId: team.groupId },
    });

    return null;
  },
});

export const setTeamImage = classMutation({
  args: {
    teamId: v.id("teams"),
    fileId: v.id("files"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "teamUpdate", { key: ctx.userId, throws: true });
    await ctx.require("groups:manage");

    const team = await ctx.db.get("teams", args.teamId);
    if (!team || team.classId !== ctx.classDoc._id) {
      throw new Error("Team not found");
    }

    const file = await requireClassImageFile(ctx, ctx.classDoc._id, args.fileId);
    await ctx.db.patch("teams", args.teamId, {
      imageFileId: args.fileId,
      updatedAt: Date.now(),
    });

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "team",
      resourceId: args.teamId,
      summary: `Set image for team “${team.name}”`,
      summaryKey: "activitySummary_setTeamImage",
      metadata: {
        name: team.name,
        fileId: args.fileId,
        fileName: file.name,
        groupId: team.groupId,
      },
    });

    return null;
  },
});

export const clearTeamImage = classMutation({
  args: {
    teamId: v.id("teams"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "teamUpdate", { key: ctx.userId, throws: true });
    await ctx.require("groups:manage");

    const team = await ctx.db.get("teams", args.teamId);
    if (!team || team.classId !== ctx.classDoc._id) {
      throw new Error("Team not found");
    }

    await ctx.db.patch("teams", args.teamId, {
      imageFileId: undefined,
      updatedAt: Date.now(),
    });

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "team",
      resourceId: args.teamId,
      summary: `Cleared image for team “${team.name}”`,
      summaryKey: "activitySummary_clearedTeamImage",
      metadata: { name: team.name, groupId: team.groupId },
    });

    return null;
  },
});

export const removeTeam = classMutation({
  args: {
    teamId: v.id("teams"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "teamRemove", { key: ctx.userId, throws: true });
    await ctx.require("groups:manage");

    const team = await ctx.db.get("teams", args.teamId);
    if (!team || team.classId !== ctx.classDoc._id) {
      throw new Error("Team not found");
    }

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded
    const memberships = await ctx.db
      .query("groupMemberships")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();
    const now = Date.now();
    for (const membership of memberships) {
      await ctx.db.patch("groupMemberships", membership._id, {
        teamId: undefined,
        updatedAt: now,
      });
    }

    await ctx.db.delete("teams", args.teamId);

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "team",
      resourceId: args.teamId,
      summary: `Deleted team “${team.name}”`,
      summaryKey: "activitySummary_deletedTeam",
      metadata: { name: team.name, groupId: team.groupId },
    });

    return null;
  },
});

/**
 * Place a student in a group/team, or clear placement (ungrouped).
 * `groupId: null` removes membership. With a group and `teamId: null`, student is group-only.
 */
export const assignStudent = classMutation({
  args: {
    studentUserId: v.id("users"),
    groupId: v.union(v.id("groups"), v.null()),
    teamId: v.optional(v.union(v.id("teams"), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "groupAssignStudent", { key: ctx.userId, throws: true });
    await ctx.require("groups:manage");

    const role = await getClassRoleForUser(ctx, args.studentUserId, ctx.scope);
    if (role !== "student") {
      throw new Error("Person must be a student in this class");
    }

    const classId = ctx.classDoc._id;
    const existing = await ctx.db
      .query("groupMemberships")
      .withIndex("by_class_student", (q) =>
        q.eq("classId", classId).eq("studentUserId", args.studentUserId),
      )
      .unique();

    if (args.groupId === null) {
      if (existing) {
        await ctx.db.delete("groupMemberships", existing._id);
        await recordClassActivity(ctx, {
          classId,
          actorUserId: ctx.userId,
          action: "update",
          resourceType: "groupMembership",
          resourceId: args.studentUserId,
          summary: "Moved student to ungrouped",
          summaryKey: "activitySummary_movedStudentToUngrouped",
          metadata: { studentUserId: args.studentUserId },
        });
      }
      return null;
    }

    const group = await ctx.db.get("groups", args.groupId);
    if (!group || group.classId !== classId) {
      throw new Error("Group not found");
    }

    if (args.teamId !== undefined && args.teamId !== null) {
      throw new Error("Assign teams via seating charts");
    }

    const now = Date.now();
    if (existing) {
      const clearingTeam = args.teamId === null || existing.groupId !== args.groupId;
      await ctx.db.patch("groupMemberships", existing._id, {
        groupId: args.groupId,
        ...(clearingTeam ? { teamId: undefined } : {}),
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("groupMemberships", {
        classId,
        groupId: args.groupId,
        studentUserId: args.studentUserId,
        updatedAt: now,
      });
    }

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "groupMembership",
      resourceId: args.studentUserId,
      summary: `Assigned student to group “${group.name}”`,
      summaryKey: "activitySummary_assignedStudentToGroup",
      metadata: {
        name: group.name,
        studentUserId: args.studentUserId,
        groupId: args.groupId,
      },
    });

    return null;
  },
});

/**
 * Move many students into a group as teamless (no team).
 * Skips students who are not in the class student role.
 */
export const assignStudents = classMutation({
  args: {
    groupId: v.id("groups"),
    studentUserIds: v.array(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "groupAssignStudents", { key: ctx.userId, throws: true });
    await ctx.require("groups:manage");

    const uniqueStudentIds = [...new Set(args.studentUserIds)];
    if (uniqueStudentIds.length === 0) {
      throw new Error("Select at least one student");
    }
    if (uniqueStudentIds.length > MAX_BULK_ASSIGN_STUDENTS) {
      throw new Error(`Can move at most ${MAX_BULK_ASSIGN_STUDENTS} students at once`);
    }

    const classId = ctx.classDoc._id;
    const group = await ctx.db.get("groups", args.groupId);
    if (!group || group.classId !== classId) {
      throw new Error("Group not found");
    }

    const now = Date.now();
    const moved: Array<Id<"users">> = [];

    for (const studentUserId of uniqueStudentIds) {
      const role = await getClassRoleForUser(ctx, studentUserId, ctx.scope);
      if (role !== "student") {
        throw new Error("Person must be a student in this class");
      }

      const existing = await ctx.db
        .query("groupMemberships")
        .withIndex("by_class_student", (q) =>
          q.eq("classId", classId).eq("studentUserId", studentUserId),
        )
        .unique();

      if (existing) {
        // `patch` cannot reliably unset optional teamId; replace without it.
        const {
          _id: _ignoredId,
          _creationTime: _ignoredCreation,
          teamId: _ignoredTeamId,
          ...rest
        } = existing;
        await ctx.db.replace("groupMemberships", existing._id, {
          ...rest,
          groupId: args.groupId,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("groupMemberships", {
          classId,
          groupId: args.groupId,
          studentUserId,
          updatedAt: now,
        });
      }
      moved.push(studentUserId);
    }

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "groupMembership",
      resourceId: args.groupId,
      summary: `Moved ${moved.length} students into group “${group.name}”`,
      summaryKey: "activitySummary_movedStudentsIntoGroup",
      metadata: {
        name: group.name,
        groupId: args.groupId,
        studentUserIds: moved.join(","),
        count: String(moved.length),
      },
    });

    return null;
  },
});
