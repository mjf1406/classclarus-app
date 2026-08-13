import { describe, expect, it } from "vite-plus/test";

import { classroomStudent } from "./classroomLayouts.js";
import {
  DEFAULT_SCENARIOS,
  SOAK_SCENARIOS,
  buildScenarioInput,
  locksForScenario,
  studentsForScenario,
  type SimScenario,
} from "./seatingScenarios.js";
import {
  countSpread,
  expectValidSolverChart,
  recordAssignmentsInHistory,
} from "./seatingTestHelpers.js";
import { seatingSimulationSeeds, seatingSoakEnabled } from "./seatingSeeds.js";
import { solveSeating } from "./solve.js";
import type { LayoutHistoryStats } from "./types.js";

function simulate(
  scenario: SimScenario,
  seed: number,
  options: {
    rosterChurn?: boolean;
    layoutChurn?: boolean;
  } = {},
) {
  let history: LayoutHistoryStats = { byStudent: new Map() };
  let students = studentsForScenario(scenario);
  let slotCount = scenario.slotCount;
  let latest = buildScenarioInput({
    scenario,
    seed: `${seed.toString(16)}:0`,
    students,
    slotCount,
  });
  let locked = locksForScenario(scenario, students, latest.slots);
  for (let run = 0; run < scenario.runs; run += 1) {
    if (options.rosterChurn && run === 2) {
      students = [...students, classroomStudent(900 + students.length)];
    }
    if (options.rosterChurn && run === 3 && students.length > 2) {
      students = students.filter((_, index) => index !== 1);
    }
    if (options.layoutChurn && run === Math.floor(scenario.runs / 2) && slotCount > 2) {
      slotCount -= 1;
    }
    latest = buildScenarioInput({
      scenario,
      seed: `${seed.toString(16)}:${run}`,
      history,
      students,
      slotCount,
    });
    locked = locksForScenario(scenario, students, latest.slots);
    latest = { ...latest, locked };
    const result = solveSeating(latest);
    expect(result.status, `scenario=${scenario.name} seed=0x${seed.toString(16)} run=${run}`).toBe(
      "ok",
    );
    if (result.status !== "ok") break;
    expectValidSolverChart(latest, result.assignments);
    history = recordAssignmentsInHistory(latest, [...locked, ...result.assignments]);
  }
  return { input: latest, history, locked };
}

function maxNeighborRepeat(history: LayoutHistoryStats): number {
  let max = 0;
  for (const stats of history.byStudent.values()) {
    for (const count of stats.neighbor.values()) {
      if (count > max) max = count;
    }
  }
  return max;
}

function maxZoneShare(history: LayoutHistoryStats, lockedIds: ReadonlySet<string>): number {
  let maxShare = 0;
  for (const [studentId, stats] of history.byStudent) {
    if (lockedIds.has(studentId) || stats.total <= 0) continue;
    const zoneCounts = [...stats.zone.values()];
    if (zoneCounts.length === 0) continue;
    const share = Math.max(...zoneCounts) / stats.total;
    if (share > maxShare) maxShare = share;
  }
  return maxShare;
}

function countStudentsWithMultipleZones(
  history: LayoutHistoryStats,
  lockedIds: ReadonlySet<string>,
): number {
  let count = 0;
  for (const [studentId, stats] of history.byStudent) {
    if (lockedIds.has(studentId) || stats.total <= 0) continue;
    if (stats.zone.size >= 2) count += 1;
  }
  return count;
}

describe("seating long-run fairness simulations", () => {
  const seeds = seatingSimulationSeeds();
  const scenarios = seatingSoakEnabled()
    ? [...DEFAULT_SCENARIOS, ...SOAK_SCENARIOS]
    : DEFAULT_SCENARIOS;

  describe.each(scenarios)("$name", (scenario) => {
    it.each([...seeds])("seed %s", { timeout: scenario.constraints ? 20_000 : 8_000 }, (seed) => {
      const { input, history, locked } = simulate(scenario, seed);
      const totals = input.students.map((student) => {
        const stats = history.byStudent.get(student.studentUserId);
        return stats ? [...stats.seat.values()].reduce((sum, count) => sum + count, 0) : 0;
      });
      expect(
        Math.min(...totals),
        `scenario=${scenario.name} seed=0x${seed.toString(16)}`,
      ).toBeGreaterThan(0);
      const allowedSpread =
        scenario.studentCount - scenario.slotCount >= 2
          ? 2
          : scenario.slotCount < scenario.studentCount
            ? 1
            : 2;
      expect(countSpread(totals)).toBeLessThanOrEqual(allowedSpread);

      const lockedIds = new Set(locked.map((row) => row.studentUserId));
      if (scenario.topology !== "complete" && !scenario.constraints && scenario.runs >= 5) {
        expect(maxNeighborRepeat(history)).toBeLessThanOrEqual(
          Math.max(3, Math.ceil(scenario.runs / 2)),
        );
      }
      if (scenario.layout && scenario.runs >= 6) {
        expect(countStudentsWithMultipleZones(history, lockedIds)).toBeGreaterThan(0);
      }
      if (
        scenario.runs >= 6 &&
        (scenario.layout || scenario.topology === "line") &&
        scenario.parity !== "oddEven" &&
        !scenario.constraints
      ) {
        const share = maxZoneShare(history, lockedIds);
        if (share > 0) {
          expect(share).toBeLessThan(1);
        }
      }
    });
  });
});

describe("seating roster and layout churn", () => {
  const scenario: SimScenario = {
    name: "churn-grid",
    studentCount: 12,
    slotCount: 16,
    layout: "grid4x5",
    parity: "off",
    runs: 6,
  };

  it("keeps solving after students join and leave", () => {
    const { input, history } = simulate(scenario, 0x1234, { rosterChurn: true });
    expect(input.students.length).toBeGreaterThan(0);
    expect(history.byStudent.size).toBeGreaterThan(0);
  });

  it("keeps solving after a desk is removed mid-sequence", () => {
    const { input } = simulate(scenario, 0x2345, { layoutChurn: true });
    expect(input.slots.length).toBe(scenario.slotCount - 1);
  });
});
