import { describe, expect, test, vi, beforeEach, afterEach } from "vite-plus/test";

import { isClassPresenceEnabled } from "@/lib/presence/presenceEnabled";

describe("isClassPresenceEnabled (client)", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      __SELF_HOST_ENV__: undefined,
    });
    vi.stubEnv("VITE_SELF_HOSTED", "");
    vi.stubEnv("VITE_CLASS_PRESENCE_ENABLED", "");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test("disabled on hosted cloud", () => {
    expect(isClassPresenceEnabled()).toBe(false);
  });

  test("enabled by default on self-host", () => {
    vi.stubEnv("VITE_SELF_HOSTED", "true");
    expect(isClassPresenceEnabled()).toBe(true);
  });

  test("disabled when self-host explicitly opts out", () => {
    vi.stubEnv("VITE_SELF_HOSTED", "true");
    vi.stubEnv("VITE_CLASS_PRESENCE_ENABLED", "false");
    expect(isClassPresenceEnabled()).toBe(false);
  });

  test("runtime self-host env overrides build-time flag", () => {
    window.__SELF_HOST_ENV__ = {
      VITE_SELF_HOSTED: "true",
      VITE_CLASS_PRESENCE_ENABLED: "false",
    };
    expect(isClassPresenceEnabled()).toBe(false);
  });
});
