import { describe, expect, it } from "vite-plus/test";

import {
  FEASIBLE_SEED_SWEEP_SCENARIOS,
  buildScenarioInput,
  locksForScenario,
  studentsForScenario,
} from "./seatingScenarios.js";
import { expectValidSolverChart } from "./seatingTestHelpers.js";
import { seatingSimulationSeeds } from "./seatingSeeds.js";
import { solveSeating } from "./solve.js";

describe("seating solver feasibility seed sweep", () => {
  const seeds = seatingSimulationSeeds();

  describe.each(FEASIBLE_SEED_SWEEP_SCENARIOS)("$name", (scenario) => {
    it.each([...seeds])("seed %s never reports search_exhausted", { timeout: 15_000 }, (seed) => {
      const students = studentsForScenario(scenario);
      const input = buildScenarioInput({
        scenario,
        seed: seed.toString(16),
        students,
      });
      const locked = locksForScenario(scenario, students, input.slots);
      const withLocks = { ...input, locked };
      const result = solveSeating(withLocks);
      expect(
        result.status,
        `scenario=${scenario.name} seed=0x${seed.toString(16)} status=${result.status}`,
      ).toBe("ok");
      if (result.status !== "ok") return;
      expectValidSolverChart(withLocks, result.assignments);
    });
  });
});
