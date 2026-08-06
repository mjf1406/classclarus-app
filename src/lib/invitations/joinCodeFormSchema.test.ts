import { describe, expect, test } from "vite-plus/test";

import {
  assignableJoinCodeRoles,
  createJoinCodeFormSchema,
  isCompleteJoinCode,
  JOIN_CODE_LENGTH,
  MAX_JOIN_CODE_USES,
  MIN_JOIN_CODE_USES,
  normalizeJoinCodeInput,
  redeemJoinCodeSchema,
  ttlMsForOption,
} from "./joinCodeFormSchema";

describe("joinCodeFormSchema", () => {
  test("normalizes and validates redeem codes", () => {
    expect(normalizeJoinCodeInput(" ab-12c ")).toBe("AB12C");
    expect(isCompleteJoinCode("ABCDEF")).toBe(true);
    expect(isCompleteJoinCode("ABCDE")).toBe(false);
    expect(redeemJoinCodeSchema.parse("ab12cd")).toBe("AB12CD");
    expect(() => redeemJoinCodeSchema.parse("short")).toThrow();
  });

  test("maps TTL options and rejects out-of-range uses", () => {
    expect(ttlMsForOption("15m")).toBe(15 * 60 * 1000);
    expect(ttlMsForOption("1d")).toBe(24 * 60 * 60 * 1000);

    const valid = createJoinCodeFormSchema.parse({
      role: "student",
      ttlOption: "1h",
      usesMode: "preset",
      usesPreset: "5",
      usesCustom: "",
    });
    expect(valid).toEqual({ role: "student", ttlMs: 60 * 60 * 1000, maxUses: 5 });

    const custom = createJoinCodeFormSchema.parse({
      role: "guardian",
      ttlOption: "6h",
      usesMode: "custom",
      usesPreset: "1",
      usesCustom: "42",
    });
    expect(custom.maxUses).toBe(42);

    expect(() =>
      createJoinCodeFormSchema.parse({
        role: "student",
        ttlOption: "1h",
        usesMode: "custom",
        usesPreset: "1",
        usesCustom: String(MAX_JOIN_CODE_USES + 1),
      }),
    ).toThrow();
    expect(() =>
      createJoinCodeFormSchema.parse({
        role: "student",
        ttlOption: "1h",
        usesMode: "custom",
        usesPreset: "1",
        usesCustom: String(MIN_JOIN_CODE_USES - 1),
      }),
    ).toThrow();
  });

  test("filters assignable roles by invite permissions", () => {
    const can = (permission: string) =>
      permission === "students:add" || permission === "guardians:invite";
    expect(assignableJoinCodeRoles(can)).toEqual(["student", "guardian"]);
    expect(JOIN_CODE_LENGTH).toBe(6);
  });
});
