import { matchesPermissionPattern } from "@djpanda/convex-authz";

import { authz } from "../authz.js";
import type { ClassRole } from "./authzModel.js";
import { isClassRole, pickHighestClassRole } from "./authzModel.js";
import type { QueryCtx } from "../_generated/server.js";

type PermissionRow = {
  permission: string;
  effect: string;
  scopeKey: string;
  sources: Array<string>;
};

/**
 * Effective allow-list for a user in a class scope.
 * Merges class-scoped + global rows with deny-wins (including wildcard patterns),
 * matching the component's `checkPermission` semantics.
 */
export async function permissionSnapshotForScope(
  ctx: Pick<QueryCtx, "runQuery">,
  userId: string,
  scope: { type: string; id: string },
): Promise<{ role: ClassRole | null; permissions: Array<string> }> {
  const [scopedRoles, scopedPerms, globalPerms] = await Promise.all([
    authz.getUserRoles(ctx, userId, scope),
    authz.getUserPermissions(ctx, userId, scope),
    authz.getUserPermissions(ctx, userId),
  ]);

  const role = pickHighestClassRole(
    scopedRoles.map((entry: { role: string }) => entry.role).filter(isClassRole),
  );

  const scopedRows = scopedPerms as Array<PermissionRow>;
  const globalRows = (globalPerms as Array<PermissionRow>).filter(
    (row) => row.scopeKey === "global",
  );

  const denyPatterns = [
    ...scopedRows.filter((row) => row.effect === "deny").map((row) => row.permission),
    ...globalRows.filter((row) => row.effect === "deny").map((row) => row.permission),
  ];

  const allowCandidates = new Set<string>();
  for (const row of scopedRows) {
    if (row.effect === "allow" && !row.permission.includes("*") && row.permission !== "*") {
      allowCandidates.add(row.permission);
    }
  }
  for (const row of globalRows) {
    // Do not disclose app-level admin:* permissions via class snapshots.
    if (row.permission.startsWith("admin:")) {
      continue;
    }
    if (row.effect === "allow" && !row.permission.includes("*") && row.permission !== "*") {
      allowCandidates.add(row.permission);
    }
  }

  const permissions = [...allowCandidates].filter(
    (permission) =>
      !permission.startsWith("admin:") &&
      !denyPatterns.some((pattern) => matchesPermissionPattern(permission, pattern)),
  );

  // If a wildcard deny covers everything, snapshot is empty even when role remains assigned.
  if (denyPatterns.some((pattern) => pattern === "*" || pattern === "*:*")) {
    return { role, permissions: [] };
  }

  return { role, permissions };
}
