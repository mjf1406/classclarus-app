import { describe, expect, test, beforeEach, afterEach } from "vite-plus/test";

import { isClassPresenceEnabled } from "./presenceEnabled";

describe("isClassPresenceEnabled (server)", () => {
  const originalSelfHosted = process.env.SELF_HOSTED;
  const originalPresence = process.env.CLASS_PRESENCE_ENABLED;

  beforeEach(() => {
    delete process.env.SELF_HOSTED;
    delete process.env.CLASS_PRESENCE_ENABLED;
  });

  afterEach(() => {
    if (originalSelfHosted === undefined) {
      delete process.env.SELF_HOSTED;
    } else {
      process.env.SELF_HOSTED = originalSelfHosted;
    }
    if (originalPresence === undefined) {
      delete process.env.CLASS_PRESENCE_ENABLED;
    } else {
      process.env.CLASS_PRESENCE_ENABLED = originalPresence;
    }
  });

  test("disabled on cloud even when env flag is true", () => {
    process.env.CLASS_PRESENCE_ENABLED = "true";
    expect(isClassPresenceEnabled()).toBe(false);
  });

  test("enabled by default on self-host", () => {
    process.env.SELF_HOSTED = "true";
    expect(isClassPresenceEnabled()).toBe(true);
  });

  test("disabled when self-host explicitly opts out", () => {
    process.env.SELF_HOSTED = "true";
    process.env.CLASS_PRESENCE_ENABLED = "false";
    expect(isClassPresenceEnabled()).toBe(false);
  });
});
