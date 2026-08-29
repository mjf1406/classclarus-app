import { describe, expect, test } from "vite-plus/test";

import { computeFitFontSize } from "./fitFontSize";

describe("computeFitFontSize", () => {
  test("returns min size for zero container", () => {
    expect(computeFitFontSize(0, 100, "99:99", 0.97, 0.95, "Inter", "400", 1.2)).toBe(8);
  });

  test("shrinks when height is tight even if width is ample", () => {
    const wideShort = computeFitFontSize(800, 40, "-99:59:59", 0.97, 0.95, "Inter", "700", 1.2);
    const wideTall = computeFitFontSize(800, 400, "-99:59:59", 0.97, 0.95, "Inter", "700", 1.2);
    expect(wideShort).toBeLessThan(wideTall);
  });

  test("respects max font size cap", () => {
    const size = computeFitFontSize(10_000, 10_000, "1:00", 0.97, 0.95, "Inter", "400", 1.2, 120);
    expect(size).toBeLessThanOrEqual(120);
  });
});
