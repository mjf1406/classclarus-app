import { describe, expect, test } from "vite-plus/test";

import { shouldAutoSetRazRti } from "./razAutoRti";

describe("shouldAutoSetRazRti", () => {
  test("level_down always sets RTI", () => {
    expect(shouldAutoSetRazRti("level_down", null)).toBe(true);
    expect(shouldAutoSetRazRti("level_down", "level_up")).toBe(true);
    expect(shouldAutoSetRazRti("level_down", "stay")).toBe(true);
  });

  test("level_up never sets RTI", () => {
    expect(shouldAutoSetRazRti("level_up", null)).toBe(false);
    expect(shouldAutoSetRazRti("level_up", "stay")).toBe(false);
    expect(shouldAutoSetRazRti("level_up", "level_down")).toBe(false);
  });

  test("single stay does not set RTI", () => {
    expect(shouldAutoSetRazRti("stay", null)).toBe(false);
    expect(shouldAutoSetRazRti("stay", undefined)).toBe(false);
  });

  test("stay after non-level-up sets RTI", () => {
    expect(shouldAutoSetRazRti("stay", "stay")).toBe(true);
    expect(shouldAutoSetRazRti("stay", "level_down")).toBe(true);
  });

  test("stay after level_up does not set RTI", () => {
    expect(shouldAutoSetRazRti("stay", "level_up")).toBe(false);
  });
});
