import { describe, expect, it } from "vite-plus/test";

import type { Id } from "../../_generated/dataModel.js";
import {
  assignmentPermutations,
  compareFairnessVector,
  expectValidSolverChart,
  recordAssignmentsInHistory,
  testInput,
  testSlots,
  testStudent,
} from "./seatingTestHelpers.js";
import { evaluateSeatingFairness, solveSeating } from "./solve.js";
import type { SeatingConstraint, SeatingStudent } from "./types.js";

function constraint(index: number, values: Omit<SeatingConstraint, "id">): SeatingConstraint {
  return { id: `constraint-${index}` as Id<"seatConstraints">, ...values };
}

describe("seating solver properties", () => {
  it("satisfies structural invariants across small generated states", () => {
    for (let studentCount = 1; studentCount <= 6; studentCount += 1) {
      for (let slotCount = 1; slotCount <= 6; slotCount += 1) {
        for (const seed of ["alpha", "beta", "gamma"]) {
          const input = testInput({ studentCount, slotCount, seed });
          const result = solveSeating(input);
          expect(result.status, `${studentCount}/${slotCount}/${seed}`).toBe("ok");
          if (result.status !== "ok") continue;
          expectValidSolverChart(input, result.assignments);
          expect(result.assignments).toHaveLength(Math.min(studentCount, slotCount));
          expect(result.meta.unseatedStudentIds).toHaveLength(
            Math.max(0, studentCount - slotCount),
          );
        }
      }
    }
  });

  it("matches a brute-force lexicographic oracle for every micro layout", () => {
    for (let studentCount = 1; studentCount <= 4; studentCount += 1) {
      for (let slotCount = studentCount; slotCount <= 5; slotCount += 1) {
        const input = testInput({
          studentCount,
          slotCount,
          seed: `oracle-${studentCount}-${slotCount}`,
        });
        const result = solveSeating(input);
        expect(result.status).toBe("ok");
        if (result.status !== "ok") continue;
        const oracle = assignmentPermutations(input)
          .map((assignments) => evaluateSeatingFairness(input, assignments))
          .sort(compareFairnessVector)[0]!;
        expect(result.meta.fairnessVector).toEqual(oracle);
      }
    }
  });

  it("uses the seed only to select among equally fair charts", () => {
    const vectors = new Set<string>();
    const charts = new Set<string>();
    for (let index = 0; index < 20; index += 1) {
      const input = testInput({
        studentCount: 3,
        slotCount: 3,
        topology: "complete",
        seed: `tie-${index}`,
      });
      const result = solveSeating(input);
      expect(result.status).toBe("ok");
      if (result.status !== "ok") continue;
      vectors.add(JSON.stringify(result.meta.fairnessVector));
      charts.add(
        result.assignments
          .map((row) => `${row.studentUserId}:${row.deskItemId}`)
          .sort()
          .join("|"),
      );
    }
    expect(vectors.size).toBe(1);
    expect(charts.size).toBeGreaterThan(1);
  });

  it("matches a constrained brute-force oracle up to the exact-search limit", () => {
    const students: SeatingStudent[] = [0, 1, 2, 3, 4].map((index) => testStudent(index));
    const constraints = [
      constraint(0, {
        type: "neighbor",
        polarity: "must",
        studentUserId: students[0]!.studentUserId,
        otherStudentUserId: students[1]!.studentUserId,
      }),
      constraint(1, {
        type: "zone",
        polarity: "mustNot",
        studentUserId: students[2]!.studentUserId,
        zoneName: "A",
      }),
    ];
    for (const seed of ["c-alpha", "c-beta"]) {
      const input = testInput({
        studentCount: 5,
        slotCount: 5,
        seed,
        students,
        constraints,
      });
      const result = solveSeating(input);
      expect(result.status).toBe("ok");
      if (result.status !== "ok") continue;
      expectValidSolverChart(input, result.assignments);
      const valid = assignmentPermutations(input).filter((assignments) => {
        try {
          expectValidSolverChart(input, assignments);
          return true;
        } catch {
          return false;
        }
      });
      expect(valid.length).toBeGreaterThan(0);
      const oracle = valid
        .map((assignments) => evaluateSeatingFairness(input, assignments))
        .sort(compareFairnessVector)[0]!;
      expect(result.meta.fairnessVector).toEqual(oracle);
    }
  });

  it("returns infeasible when exact search proves no legal chart", () => {
    const students = [testStudent(0), testStudent(1)];
    const input = testInput({
      studentCount: 2,
      slotCount: 2,
      students,
      slots: testSlots(2),
      constraints: [
        constraint(0, {
          type: "neighbor",
          polarity: "must",
          studentUserId: students[0]!.studentUserId,
          otherStudentUserId: students[1]!.studentUserId,
        }),
        constraint(1, {
          type: "neighbor",
          polarity: "mustNot",
          studentUserId: students[0]!.studentUserId,
          otherStudentUserId: students[1]!.studentUserId,
        }),
      ],
    });
    const result = solveSeating(input);
    expect(result.status).toBe("infeasible");
    const valid = assignmentPermutations(input).filter((assignments) => {
      try {
        expectValidSolverChart(input, assignments);
        return true;
      } catch {
        return false;
      }
    });
    expect(valid).toHaveLength(0);
  });

  it("keeps incremental local-search fairness identical to a full recompute", () => {
    const first = testInput({
      studentCount: 12,
      slotCount: 12,
      topology: "line",
      seed: "delta-history",
    });
    const firstResult = solveSeating(first);
    expect(firstResult.status).toBe("ok");
    if (firstResult.status !== "ok") return;
    const input = {
      ...first,
      history: recordAssignmentsInHistory(first, firstResult.assignments),
      randomSeed: "delta-improve",
    };
    const result = solveSeating(input);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.assignments.length).toBe(12);
    expect(result.meta.fairnessVector).toEqual(
      evaluateSeatingFairness(input, [...input.locked, ...result.assignments]),
    );
  });
});
