import type { AuthConfig } from "convex/server";

/**
 * OIDC provider for Convex Auth tokens.
 * Domain must be reachable from the backend (self-host: use loopback
 * CONVEX_SITE_ORIGIN so Docker hairpin NAT does not break discovery).
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL ?? "",
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
