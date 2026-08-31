import { describe, expect, test } from "vite-plus/test";

import {
  countRazZ2Passes,
  isRazZ2Pass,
  nextRazManualStatusAfterAssessment,
  RAZ_INELIGIBLE_Z2_PASS_COUNT,
  resolveRazAutoManualStatus,
  shouldAutoSetRazIneligible,
  shouldAutoSetRazRti,
} from "./razAutoRti";

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

describe("isRazZ2Pass", () => {
  test("stay and level_up at Z2 are passes", () => {
    expect(isRazZ2Pass("Z2", "stay")).toBe(true);
    expect(isRazZ2Pass("Z2", "level_up")).toBe(true);
  });

  test("level_down at Z2 is not a pass", () => {
    expect(isRazZ2Pass("Z2", "level_down")).toBe(false);
  });

  test("passes at lower levels do not count", () => {
    expect(isRazZ2Pass("Z1", "stay")).toBe(false);
    expect(isRazZ2Pass("A", "level_up")).toBe(false);
  });
});

describe("shouldAutoSetRazIneligible", () => {
  const z2Stay = { level: "Z2" as const, result: "stay" as const };

  test("requires a Z2 pass on the current assessment", () => {
    const prior = Array.from({ length: RAZ_INELIGIBLE_Z2_PASS_COUNT }, () => z2Stay);
    expect(
      shouldAutoSetRazIneligible({
        level: "Z2",
        result: "level_down",
        priorAssessments: prior,
      }),
    ).toBe(false);
    expect(
      shouldAutoSetRazIneligible({
        level: "Z1",
        result: "stay",
        priorAssessments: prior,
      }),
    ).toBe(false);
  });

  test("sets ineligible on the seventh Z2 pass", () => {
    const sixPasses = Array.from({ length: RAZ_INELIGIBLE_Z2_PASS_COUNT - 1 }, () => z2Stay);
    expect(
      shouldAutoSetRazIneligible({
        level: "Z2",
        result: "stay",
        priorAssessments: sixPasses,
      }),
    ).toBe(true);
    expect(
      shouldAutoSetRazIneligible({
        level: "Z2",
        result: "level_up",
        priorAssessments: sixPasses,
      }),
    ).toBe(true);
  });

  test("does not set ineligible before seven Z2 passes", () => {
    const fivePasses = Array.from({ length: RAZ_INELIGIBLE_Z2_PASS_COUNT - 2 }, () => z2Stay);
    expect(
      shouldAutoSetRazIneligible({
        level: "Z2",
        result: "stay",
        priorAssessments: fivePasses,
      }),
    ).toBe(false);
    expect(
      shouldAutoSetRazIneligible({
        level: "Z2",
        result: "stay",
        priorAssessments: [],
      }),
    ).toBe(false);
  });

  test("ignores non-passing and non-Z2 prior assessments", () => {
    const prior = [
      ...Array.from({ length: 4 }, () => z2Stay),
      { level: "Z2", result: "level_down" as const },
      { level: "Z1", result: "stay" as const },
      ...Array.from({ length: 2 }, () => z2Stay),
    ];
    expect(countRazZ2Passes(prior)).toBe(6);
    expect(
      shouldAutoSetRazIneligible({
        level: "Z2",
        result: "stay",
        priorAssessments: prior,
      }),
    ).toBe(true);
  });
});

describe("resolveRazAutoManualStatus", () => {
  const z2Stay = { level: "Z2" as const, result: "stay" as const };

  test("ineligible wins over RTI on the seventh Z2 pass", () => {
    const sixPasses = Array.from({ length: RAZ_INELIGIBLE_Z2_PASS_COUNT - 1 }, () => z2Stay);
    expect(
      resolveRazAutoManualStatus({
        level: "Z2",
        result: "stay",
        previousResult: "stay",
        priorAssessments: sixPasses,
      }),
    ).toBe("ineligible");
  });

  test("Z2 pass does not auto-set RTI (stay is success at max level)", () => {
    expect(
      resolveRazAutoManualStatus({
        level: "Z2",
        result: "stay",
        previousResult: "stay",
        priorAssessments: [z2Stay],
      }),
    ).toBeNull();
  });

  test("Z2 level_down still auto-sets RTI", () => {
    expect(
      resolveRazAutoManualStatus({
        level: "Z2",
        result: "level_down",
        previousResult: "stay",
        priorAssessments: [z2Stay],
      }),
    ).toBe("rti");
  });

  test("lower-level stay after stay still auto-sets RTI", () => {
    expect(
      resolveRazAutoManualStatus({
        level: "M",
        result: "stay",
        previousResult: "stay",
        priorAssessments: [{ level: "M", result: "stay" }],
      }),
    ).toBe("rti");
  });

  test("returns null when nothing should change", () => {
    expect(
      resolveRazAutoManualStatus({
        level: "B",
        result: "level_up",
        previousResult: "stay",
        priorAssessments: [],
      }),
    ).toBeNull();
  });
});

describe("nextRazManualStatusAfterAssessment", () => {
  test("clears pending back to Auto when auto-status does not apply", () => {
    expect(
      nextRazManualStatusAfterAssessment({
        level: "B",
        result: "level_up",
        previousResult: "stay",
        priorAssessments: [],
        currentManualStatus: "pending",
      }),
    ).toBeNull();
  });

  test("pending becomes RTI when auto-RTI applies", () => {
    expect(
      nextRazManualStatusAfterAssessment({
        level: "B",
        result: "level_down",
        previousResult: "stay",
        priorAssessments: [],
        currentManualStatus: "pending",
      }),
    ).toBe("rti");
  });

  test("leaves RTI unchanged when auto-status does not apply", () => {
    expect(
      nextRazManualStatusAfterAssessment({
        level: "B",
        result: "level_up",
        previousResult: "stay",
        priorAssessments: [],
        currentManualStatus: "rti",
      }),
    ).toBe("rti");
  });

  test("leaves ineligible unchanged when auto-status does not apply", () => {
    expect(
      nextRazManualStatusAfterAssessment({
        level: "B",
        result: "level_up",
        previousResult: "stay",
        priorAssessments: [],
        currentManualStatus: "ineligible",
      }),
    ).toBe("ineligible");
  });

  test("leaves Auto unchanged when auto-status does not apply", () => {
    expect(
      nextRazManualStatusAfterAssessment({
        level: "B",
        result: "level_up",
        previousResult: "stay",
        priorAssessments: [],
        currentManualStatus: null,
      }),
    ).toBeNull();
  });

  test("pending becomes ineligible on the seventh Z2 pass", () => {
    const sixPasses = Array.from({ length: RAZ_INELIGIBLE_Z2_PASS_COUNT - 1 }, () => ({
      level: "Z2" as const,
      result: "stay" as const,
    }));
    expect(
      nextRazManualStatusAfterAssessment({
        level: "Z2",
        result: "stay",
        previousResult: "stay",
        priorAssessments: sixPasses,
        currentManualStatus: "pending",
      }),
    ).toBe("ineligible");
  });
});
