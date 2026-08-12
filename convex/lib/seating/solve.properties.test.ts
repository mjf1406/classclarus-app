import { describe, expect, it } from "vite-plus/test";

import type { ChartAssignment } from "./seatChartGeometry.js";
import { expectStructuralInvariants, testInput } from "./seatingTestHelpers.js";
import { evaluateSeatingFairness, solveSeating } from "./solve.js";

function compareVector(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function assignmentPermutations(
  input: ReturnType<typeof testInput>,
  studentIndex = 0,
  used = new Set<string>(),
  rows: ChartAssignment[] = [],
): ChartAssignment[][] {
  if (studentIndex === input.students.length) return [[...rows]];
  const student = input.students[studentIndex]!;
  const results: ChartAssignment[][] = [];
  for (const slot of input.slots) {
    if (used.has(slot.deskItemId)) continue;
    used.add(slot.deskItemId);
    rows.push({
      studentUserId: student.studentUserId,
      groupId: student.groupId,
      deskItemId: slot.deskItemId,
    });
    results.push(...assignmentPermutations(input, studentIndex + 1, used, rows));
    rows.pop();
    used.delete(slot.deskItemId);
  }
  return results;
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
          expectStructuralInvariants(input, result.assignments);
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
          .sort(compareVector)[0]!;
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
});
