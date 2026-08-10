import type { Doc, Id } from "../_generated/dataModel.js";
import type { MutationCtx } from "../_generated/server.js";

type LayoutItem = Doc<"seatLayouts">["items"][number];

export function rewriteLayoutItemsByNameTeamLabel(
  items: Array<LayoutItem>,
  oldName: string,
  newName: string,
): { items: Array<LayoutItem>; changed: boolean } {
  const oldKey = oldName.trim().toLowerCase();
  const newTrimmed = newName.trim();
  if (!oldKey || oldKey === newTrimmed.toLowerCase()) {
    return { items, changed: false };
  }

  let changed = false;
  const nextItems = items.map((item) => {
    if (item.kind !== "desk" || item.teamAssignment?.mode !== "byName") {
      return item;
    }
    if (item.teamAssignment.teamName.trim().toLowerCase() !== oldKey) {
      return item;
    }
    changed = true;
    return {
      ...item,
      teamAssignment: { mode: "byName" as const, teamName: newTrimmed },
    };
  });

  return { items: nextItems, changed };
}

export function clearLayoutItemsTeamAssignments(
  items: Array<LayoutItem>,
  teamId: Id<"teams">,
  teamName: string,
  clearByName: boolean,
): { items: Array<LayoutItem>; changed: boolean } {
  const nameKey = teamName.trim().toLowerCase();
  let changed = false;

  const nextItems = items.map((item) => {
    if (item.kind !== "desk" || !item.teamAssignment) {
      return item;
    }

    const assignment = item.teamAssignment;
    const shouldClearSingle = assignment.mode === "single" && assignment.teamId === teamId;
    const shouldClearByName =
      clearByName &&
      assignment.mode === "byName" &&
      assignment.teamName.trim().toLowerCase() === nameKey;

    if (!shouldClearSingle && !shouldClearByName) {
      return item;
    }

    changed = true;
    const { teamAssignment: _removed, ...rest } = item;
    return rest;
  });

  return { items: nextItems, changed };
}

export async function rewriteLayoutByNameTeamLabels(
  ctx: MutationCtx,
  classId: Id<"classes">,
  oldName: string,
  newName: string,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded layouts
  const layouts = await ctx.db
    .query("seatLayouts")
    .withIndex("by_class", (q) => q.eq("classId", classId))
    .collect();

  const now = Date.now();
  for (const layout of layouts) {
    const { items, changed } = rewriteLayoutItemsByNameTeamLabel(layout.items, oldName, newName);
    if (!changed) continue;
    await ctx.db.patch("seatLayouts", layout._id, { items, updatedAt: now });
  }
}

export async function clearLayoutTeamAssignmentsForRemovedTeam(
  ctx: MutationCtx,
  classId: Id<"classes">,
  teamId: Id<"teams">,
  teamName: string,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded teams
  const teams = await ctx.db
    .query("teams")
    .withIndex("by_class", (q) => q.eq("classId", classId))
    .collect();
  const clearByName = !teams.some(
    (team) =>
      team._id !== teamId && team.name.trim().toLowerCase() === teamName.trim().toLowerCase(),
  );

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded layouts
  const layouts = await ctx.db
    .query("seatLayouts")
    .withIndex("by_class", (q) => q.eq("classId", classId))
    .collect();

  const now = Date.now();
  for (const layout of layouts) {
    const { items, changed } = clearLayoutItemsTeamAssignments(
      layout.items,
      teamId,
      teamName,
      clearByName,
    );
    if (!changed) continue;
    await ctx.db.patch("seatLayouts", layout._id, { items, updatedAt: now });
  }
}

export async function classHasOtherTeamWithName(
  ctx: MutationCtx,
  classId: Id<"classes">,
  teamId: Id<"teams">,
  name: string,
): Promise<boolean> {
  const target = name.trim().toLowerCase();
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded teams
  const teams = await ctx.db
    .query("teams")
    .withIndex("by_class", (q) => q.eq("classId", classId))
    .collect();
  return teams.some((team) => team._id !== teamId && team.name.trim().toLowerCase() === target);
}
