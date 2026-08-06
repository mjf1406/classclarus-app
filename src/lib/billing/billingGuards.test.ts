import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { APP_CONFIG } from "../../../convex/appConfig";
import {
  isAllowedAppOrigin,
  resolveAppOrigin,
  resolveAppUrl,
} from "../../../convex/lib/billingGuards";

describe("billingGuards URL helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("resolveAppUrl joins origin and path", () => {
    const origin = resolveAppOrigin();
    expect(resolveAppUrl("/billing")).toBe(`${origin.replace(/\/$/, "")}/billing`);
    expect(resolveAppUrl("billing")).toBe(`${origin.replace(/\/$/, "")}/billing`);
  });

  test("isAllowedAppOrigin accepts brand and localhost", () => {
    expect(isAllowedAppOrigin(APP_CONFIG.appUrl)).toBe(true);
    expect(isAllowedAppOrigin("http://localhost:5173")).toBe(true);
    expect(isAllowedAppOrigin("http://127.0.0.1:5173")).toBe(true);
  });

  test("isAllowedAppOrigin rejects disallowed origins", () => {
    expect(isAllowedAppOrigin("https://evil.com")).toBe(false);
    expect(isAllowedAppOrigin("javascript:alert(1)")).toBe(false);
    expect(isAllowedAppOrigin("not-a-url")).toBe(false);
    expect(isAllowedAppOrigin("ftp://localhost")).toBe(false);
  });

  test("resolveAppOrigin falls back when SITE_URL is missing", () => {
    vi.stubEnv("SITE_URL", "");
    expect(resolveAppOrigin()).toBe(APP_CONFIG.appUrl.replace(/\/$/, ""));
  });

  test("resolveAppOrigin falls back when SITE_URL is disallowed", () => {
    vi.stubEnv("SITE_URL", "https://evil.com");
    expect(resolveAppOrigin()).toBe(APP_CONFIG.appUrl.replace(/\/$/, ""));
  });

  test("resolveAppOrigin accepts localhost SITE_URL", () => {
    vi.stubEnv("SITE_URL", "http://localhost:5173/");
    expect(resolveAppOrigin()).toBe("http://localhost:5173");
  });
});
