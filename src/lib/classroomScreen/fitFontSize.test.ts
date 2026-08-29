import { describe, expect, test } from "vite-plus/test";

import {
  computeFitFontSize,
  parseLineHeightMultiplier,
  remainingFitHeight,
  type FitFontAxis,
} from "./fitFontSize";

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
    expect(size).toBe(120);
  });

  test("returns configured maximum when container is large enough", () => {
    const size = computeFitFontSize(10_000, 10_000, "12:34", 0.97, 0.95, "Inter", "400", 1.2, 72);
    expect(size).toBe(72);
  });

  test("shrinks below maximum when pane height decreases", () => {
    const benchmark = "88:88:88";
    const tall = computeFitFontSize(800, 400, benchmark, 0.97, 0.95, "Inter", "400", 1.2, 144);
    const short = computeFitFontSize(800, 80, benchmark, 0.97, 0.95, "Inter", "400", 1.2, 144);
    expect(tall).toBeLessThanOrEqual(144);
    expect(short).toBeLessThan(tall);
  });
});

describe("parseLineHeightMultiplier", () => {
  test("converts pixel line-height using the current font size", () => {
    expect(parseLineHeightMultiplier("80px", 80)).toBe(1);
    expect(parseLineHeightMultiplier("96px", 80)).toBe(1.2);
  });

  test("keeps unitless multipliers", () => {
    expect(parseLineHeightMultiplier("1", 16)).toBe(1);
    expect(parseLineHeightMultiplier("normal", 16)).toBe(1.2);
  });
});

describe("computeFitFontSize width-only mode", () => {
  test("uses configured max size when width is ample even if height is tight", () => {
    const size = computeFitFontSize(
      800,
      20,
      "Saturday, August 29, 2026",
      0.97,
      0.95,
      "Inter",
      "400",
      1.2,
      32,
      "width" satisfies FitFontAxis,
    );
    expect(size).toBe(32);
  });

  test("ignores height constraints compared to both-axis fitting", () => {
    const widthOnly = computeFitFontSize(
      800,
      20,
      "Saturday, August 29, 2026",
      0.97,
      0.95,
      "Inter",
      "400",
      1.2,
      32,
      "width",
    );
    const bothAxes = computeFitFontSize(
      800,
      20,
      "Saturday, August 29, 2026",
      0.97,
      0.95,
      "Inter",
      "400",
      1.2,
      32,
      "both",
    );
    expect(widthOnly).toBe(32);
    expect(bothAxes).toBeLessThan(widthOnly);
  });
});

describe("remainingFitHeight", () => {
  test("leaves leftover height after reserved siblings and gaps", () => {
    expect(remainingFitHeight(200, 0, 4, 3, [24, 80])).toBe(88);
  });

  test("subtracts vertical padding", () => {
    expect(remainingFitHeight(200, 16, 0, 1, [0])).toBe(184);
  });

  test("returns 0 when reserved content fills the pane", () => {
    expect(remainingFitHeight(100, 8, 4, 3, [50, 50])).toBe(0);
  });

  test("shrinks leftover when the pane gets shorter", () => {
    const reserved = [28, 72];
    const tall = remainingFitHeight(400, 8, 4, 3, reserved);
    const short = remainingFitHeight(160, 8, 4, 3, reserved);
    expect(short).toBeLessThan(tall);
    expect(short).toBe(44);
  });
});
