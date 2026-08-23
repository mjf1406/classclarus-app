import { describe, expect, test } from "vite-plus/test";

import { createdAfterMsForPreset, kindFilterArg } from "./history";

describe("notification history date presets", () => {
  test("converts presets to createdAfterMs without using Date.now internally", () => {
    const now = 1_000_000_000_000;
    expect(createdAfterMsForPreset("all", now)).toBeUndefined();
    expect(createdAfterMsForPreset("7d", now)).toBe(now - 7 * 24 * 60 * 60 * 1000);
    expect(createdAfterMsForPreset("30d", now)).toBe(now - 30 * 24 * 60 * 60 * 1000);
    expect(createdAfterMsForPreset("90d", now)).toBe(now - 90 * 24 * 60 * 60 * 1000);
  });

  test("omits kind when the filter is all", () => {
    expect(kindFilterArg("all")).toBeUndefined();
    expect(kindFilterArg("calendar_reminder")).toBe("calendar_reminder");
  });
});
