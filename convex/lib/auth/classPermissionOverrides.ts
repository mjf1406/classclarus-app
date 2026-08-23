import { matchesPermissionPattern } from "@djpanda/convex-authz";

import { APP_CONFIG } from "../../appConfig.js";
import { authz } from "../../authz.js";
import { components } from "../../_generated/api.js";
import type { Id } from "../../_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "../../_generated/server.js";
import { classScope, type AppPermission, type PermissionOverrideEffect } from "./authzModel.js";

type PermissionOverrideRow = {
  permission: string;
  effect: "allow" | "deny";
  scope?: { type: string; id: string };
};

export async function listUserPermissionOverrides(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<Array<PermissionOverrideRow>> {
  return (await ctx.runQuery(components.authz.queries.getPermissionOverrides, {
    tenantId: APP_CONFIG.authzTenantId,
    userId,
  })) as Array<PermissionOverrideRow>;
}

/** True when an override denies `class:read` globally or for this class (including `*`). */
export function classReadDeniedByOverrides(
  rows: Array<PermissionOverrideRow>,
  classId: string,
): boolean {
  return rows.some((row) => {
    if (row.effect !== "deny") return false;
    const deniesRead =
      row.permission === "*" ||
      row.permission === "*:*" ||
      matchesPermissionPattern("class:read", row.permission);
    if (!deniesRead) return false;
    if (!row.scope) return true;
    return row.scope.type === "class" && row.scope.id === classId;
  });
}

export async function listClassPermissionOverrides(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  userId: string,
): Promise<Array<{ permission: string; effect: PermissionOverrideEffect }>> {
  const scope = classScope(classId);
  const rows = await listUserPermissionOverrides(ctx, userId);

  return rows
    .filter(
      (row) =>
        row.scope?.type === scope.type &&
        row.scope.id === scope.id &&
        (row.effect === "allow" || row.effect === "deny"),
    )
    .map((row) => ({
      permission: row.permission,
      effect: row.effect,
    }));
}

/** Fine-grained overrides only — excludes suspend wildcard `*`. */
export async function hasFineGrainedClassPermissionOverrides(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  userId: string,
): Promise<boolean> {
  const overrides = await listClassPermissionOverrides(ctx, classId, userId);
  return overrides.some((row) => row.permission !== "*");
}

/** Clear every class-scoped override (including suspend `*`) for a clean role baseline. */
export async function clearClassPermissionOverrides(
  ctx: MutationCtx,
  classId: Id<"classes">,
  userId: string,
): Promise<number> {
  const scope = classScope(classId);
  const overrides = await listClassPermissionOverrides(ctx, classId, userId);
  let removed = 0;
  for (const row of overrides) {
    // Stored overrides may include wildcards (e.g. suspend `*`) beyond the typed catalog.
    const permission = row.permission as AppPermission | "*";
    const ok = await authz.removeOverride(ctx, userId, permission, scope);
    if (ok) removed += 1;
  }
  return removed;
}
