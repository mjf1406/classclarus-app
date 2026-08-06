import { Authz } from "@djpanda/convex-authz";

import { APP_CONFIG } from "./appConfig.js";
import { components } from "./_generated/api.js";
import { permissions, roles } from "./lib/authzModel.js";

export const authz = new Authz(components.authz, {
  permissions,
  roles,
  tenantId: APP_CONFIG.authzTenantId,
});
