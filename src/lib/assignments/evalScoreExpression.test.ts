import { describe, expect, test } from "vite-plus/test";

import {
  clampScorePoints,
  evalScoreExpression,
  isScorePointsInRange,
  normalizeScorePoints,
} from "@/lib/assignments/evalScoreExpression";

describe("evalScoreExpression", () => {
  test("parses plain numbers", () => {
    expect(evalScoreExpression("4")).toBe(4);
    expect(evalScoreExpression(" 12.5 ")).toBe(12.5);
    expect(evalScoreExpression("-3")).toBe(-3);
  });

  test("evaluates arithmetic on blur-style expressions", () => {
    expect(evalScoreExpression("2+2")).toBe(4);
    expect(evalScoreExpression("10-3")).toBe(7);
    expect(evalScoreExpression("3*4")).toBe(12);
    expect(evalScoreExpression("8/2")).toBe(4);
    expect(evalScoreExpression("(2+3)*4")).toBe(20);
    expect(evalScoreExpression("2 + 2 * 3")).toBe(8);
  });

  test("returns null for empty or invalid input", () => {
    expect(evalScoreExpression("")).toBeNull();
    expect(evalScoreExpression("   ")).toBeNull();
    expect(evalScoreExpression("2+")).toBeNull();
    expect(evalScoreExpression("abc")).toBeNull();
    expect(evalScoreExpression("2^3")).toBeNull();
  });
});

describe("clampScorePoints", () => {
  test("clamps into range", () => {
    expect(clampScorePoints(-1, 10)).toBe(0);
    expect(clampScorePoints(11, 10)).toBe(10);
    expect(clampScorePoints(7.5, 10)).toBe(7.5);
  });
});

describe("isScorePointsInRange", () => {
  test("accepts values inside [0, max]", () => {
    expect(isScorePointsInRange(0, 10)).toBe(true);
    expect(isScorePointsInRange(10, 10)).toBe(true);
    expect(isScorePointsInRange(7.5, 10)).toBe(true);
  });

  test("rejects values outside range", () => {
    expect(isScorePointsInRange(-0.1, 10)).toBe(false);
    expect(isScorePointsInRange(10.001, 10)).toBe(false);
    expect(isScorePointsInRange(Number.NaN, 10)).toBe(false);
  });
});

describe("normalizeScorePoints", () => {
  test("rounds to thousandths", () => {
    expect(normalizeScorePoints(1.2345)).toBe(1.235);
  });
});
