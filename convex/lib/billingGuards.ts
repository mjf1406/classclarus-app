import { ConvexError } from "convex/values";

import { APP_CONFIG } from "../appConfig.js";
import { POLAR_ENV } from "./polarEnv.js";

/**
 * Reject product IDs that are not the configured monthly/yearly plans.
 */
export function assertConfiguredProduct(productId: string): void {
  const allowed = new Set(
    [POLAR_ENV.monthlyProductId, POLAR_ENV.yearlyProductId].filter((id) => id.length > 0),
  );
  if (!allowed.has(productId)) {
    throw new ConvexError({
      code: "INVALID_PRODUCT",
      message: "Unknown product",
    });
  }
}

function brandOrigin(): string {
  return APP_CONFIG.appUrl.replace(/\/$/, "");
}

function isLocalDevHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * Whether `SITE_URL` may be used as the Polar redirect / embed origin.
 * Allows the brand app origin, or localhost / 127.0.0.1 for local Convex + Vite.
 */
export function isAllowedAppOrigin(siteUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(siteUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  const brand = new URL(brandOrigin());
  if (parsed.origin === brand.origin) {
    return true;
  }

  return isLocalDevHost(parsed.hostname);
}

/**
 * App origin for Polar redirect / embed URLs.
 * Prefers a validated `SITE_URL` (dev localhost or brand SPA) over `APP_CONFIG.appUrl`.
 * Invalid / disallowed values fall back to the brand URL — never an arbitrary origin.
 */
export function resolveAppOrigin(): string {
  const siteUrl = process.env.SITE_URL?.trim().replace(/\/$/, "");
  if (siteUrl && isAllowedAppOrigin(siteUrl)) {
    return siteUrl;
  }
  return brandOrigin();
}

/** Build an absolute same-app URL from a path (must start with `/`). */
export function resolveAppUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${resolveAppOrigin()}${normalized}`;
}
