import { Authz, definePermissions, defineRoles } from "@djpanda/convex-authz";
import { TENANTS_PERMISSIONS, TENANTS_ROLES } from "@djpanda/convex-tenants";
import { components } from "./_generated/api.js";

// Step 1: Define permissions — include tenants defaults + your app-specific resources
const permissions = definePermissions(TENANTS_PERMISSIONS, {
  // Add app-specific resources:
  // billing: { manage: true, view: true, export: true },
  // projects: { create: true, read: true, update: true, delete: true },
  documents: {
    create: true,
    read: true,
    update: true,
    delete: true,
  },
  settings: {
    view: true,
    manage: true,
  },
});

// Step 2: Define roles — include tenants defaults + your app-specific extensions
const roles = defineRoles(permissions, TENANTS_ROLES, {
  // Extend existing roles with app-specific permissions:
  // owner: { billing: ["manage", "view", "export"] },
  // admin: { billing: ["view"] },
  // Add completely new roles:
  // billing_admin: {
  //   organizations: ["read"],
  //   billing: ["manage", "view", "export"],
  // },
  // Step 2: Define roles
  admin: {
    documents: ["create", "read", "update", "delete"],
    settings: ["view", "manage"],
  },
  editor: {
    documents: ["create", "read", "update"],
    settings: ["view"],
  },
  viewer: {
    documents: ["read"],
  },
});

// Step 3: Create the Authz client
// `tenantId` is required by authz. Pass any constant — your app name is fine.
// Multi-tenant isolation is handled by tenants automatically: every authz
// operation tied to an organization is routed through `withTenant(orgId)` so
// authz partitions data per-org. There is no need (and no API) to vary the
// constructor's `tenantId` per request when going through tenants.
export const authz = new Authz(components.authz, { permissions, roles, tenantId: "my-app" });
