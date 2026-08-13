import { describe, expect, it } from "vite-plus/test";

import {
  TEST_CLASSROOM_GROUP_ID,
  TEST_CLASSROOM_LAYOUT_ID,
  classroomStudents,
  gridLayout,
} from "./classroomLayouts.js";
import { compatibleClassroomConstraints } from "./seatingScenarios.js";
import { classroomSlotsFromItems, expectValidSolverChart } from "./seatingTestHelpers.js";
import { solveSeating } from "./solve.js";

describe("seating solver performance budget", () => {
  it("completes a 40-student classroom without hanging", () => {
    const layout = gridLayout(5, 8);
    const started = Date.now();
    const input = {
      layoutId: TEST_CLASSROOM_LAYOUT_ID,
      slots: classroomSlotsFromItems({
        items: layout.items,
        groupIds: [TEST_CLASSROOM_GROUP_ID],
      }),
      students: classroomStudents(40),
      locked: [],
      constraints: [],
      history: { byStudent: new Map() },
      scope: { kind: "class" as const },
      genderParityMode: "off" as const,
      genderParityAssignment: { malesOnOddDesks: true },
      randomSeed: "perf-40",
    };
    const result = solveSeating(input);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expectValidSolverChart(input, result.assignments);
    expect(result.assignments).toHaveLength(40);
    expect(Date.now() - started).toBeLessThan(3_000);
  });

  it("completes a 40-student classroom with constraints and parity", () => {
    const layout = gridLayout(6, 8);
    const students = classroomStudents(40);
    const started = Date.now();
    const input = {
      layoutId: TEST_CLASSROOM_LAYOUT_ID,
      slots: classroomSlotsFromItems({
        items: layout.items,
        groupIds: [TEST_CLASSROOM_GROUP_ID],
      }),
      students,
      locked: [],
      constraints: compatibleClassroomConstraints(students),
      history: { byStudent: new Map() },
      scope: { kind: "class" as const },
      genderParityMode: "oddEven" as const,
      genderParityAssignment: { malesOnOddDesks: true },
      randomSeed: "perf-40-constrained",
    };
    const result = solveSeating(input);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expectValidSolverChart(input, result.assignments);
    expect(result.assignments).toHaveLength(40);
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});
