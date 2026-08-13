import { describe, expect, it } from "vite-plus/test";

import type { Id } from "../../_generated/dataModel.js";
import {
  assignmentByStudentId,
  expectValidSolverChart,
  testInput,
  testSlots,
  testStudent,
} from "./seatingTestHelpers.js";
import { evaluateSeatingFairness, solveSeating } from "./solve.js";
import type { SeatingConstraint } from "./types.js";

function constraint(index: number, values: Omit<SeatingConstraint, "id">): SeatingConstraint {
  return { id: `constraint-${index}` as Id<"seatConstraints">, ...values };
}

function chartSignature(assignments: ReadonlyArray<{ studentUserId: string; deskItemId: string }>) {
  return assignments
    .map((row) => `${row.studentUserId}:${row.deskItemId}`)
    .sort()
    .join("|");
}

describe("seating solver metamorphic properties", () => {
  it("is invariant to student and slot order", () => {
    const base = testInput({ studentCount: 5, slotCount: 5, seed: "permute" });
    const reversed = {
      ...base,
      students: [...base.students].reverse(),
      slots: [...base.slots].reverse(),
    };
    const first = solveSeating(base);
    const second = solveSeating(reversed);
    expect(first).toEqual(second);
  });

  it("keeps the fairness vector when only the seed changes on a complete graph", () => {
    const vectors = new Set<string>();
    for (let index = 0; index < 12; index += 1) {
      const input = testInput({
        studentCount: 4,
        slotCount: 4,
        topology: "complete",
        seed: `meta-seed-${index}`,
      });
      const result = solveSeating(input);
      expect(result.status).toBe("ok");
      if (result.status !== "ok") continue;
      vectors.add(JSON.stringify(result.meta.fairnessVector));
    }
    expect(vectors.size).toBe(1);
  });

  it("does not assign a historically loaded seat when an unused alternative exists", () => {
    const student = testStudent(0);
    const input = testInput({
      studentCount: 1,
      slotCount: 2,
      students: [student],
      history: {
        byStudent: new Map([
          [
            student.studentUserId,
            {
              seat: new Map([
                [`${testInput({ studentCount: 1, slotCount: 2 }).layoutId}:desk-0`, 9],
              ]),
              zone: new Map(),
              team: new Map(),
              neighbor: new Map(),
              combination: new Map(),
              total: 9,
            },
          ],
        ]),
      },
    });
    const result = solveSeating(input);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.assignments[0]?.deskItemId).toBe("desk-1");
  });

  it("never introduces a new hard-constraint violation when a mustNot is added", () => {
    const students = [testStudent(0), testStudent(1), testStudent(2)];
    const base = testInput({
      studentCount: 3,
      slotCount: 3,
      students,
      seed: "mono-constraint",
    });
    const first = solveSeating(base);
    expect(first.status).toBe("ok");
    if (first.status !== "ok") return;
    expectValidSolverChart(base, first.assignments);
    const byStudent = assignmentByStudentId(first.assignments);
    const left = byStudent.get(students[0]!.studentUserId);
    const right = byStudent.get(students[2]!.studentUserId);
    if (!left || !right) return;
    const alreadyNeighbors = Math.abs(
      Number(left.deskItemId.split("-")[1]) - Number(right.deskItemId.split("-")[1]),
    );
    if (alreadyNeighbors === 1) return;
    const tightened = {
      ...base,
      constraints: [
        constraint(0, {
          type: "neighbor",
          polarity: "mustNot",
          studentUserId: students[0]!.studentUserId,
          otherStudentUserId: students[2]!.studentUserId,
        }),
      ],
    };
    const second = solveSeating(tightened);
    expect(second.status).toBe("ok");
    if (second.status !== "ok") return;
    expectValidSolverChart(tightened, second.assignments);
  });

  it("keeps a newly locked student off the movable assignment list", () => {
    const students = [testStudent(0), testStudent(1), testStudent(2)];
    const input = testInput({
      studentCount: 3,
      slotCount: 3,
      students,
      locked: [
        {
          studentUserId: students[0]!.studentUserId,
          groupId: students[0]!.groupId,
          deskItemId: "desk-1",
        },
      ],
    });
    const result = solveSeating(input);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expectValidSolverChart(input, result.assignments);
    expect(result.assignments.some((row) => row.studentUserId === students[0]!.studentUserId)).toBe(
      false,
    );
  });

  it("preserves fairness under consistent desk-id relabeling in history keys", () => {
    const input = testInput({ studentCount: 3, slotCount: 3, seed: "relabel" });
    const first = solveSeating(input);
    expect(first.status).toBe("ok");
    if (first.status !== "ok") return;
    const relabeledSlots = testSlots(3).map((slot) => ({
      ...slot,
      deskItemId: `seat-${slot.deskItemId.split("-")[1]}`,
      neighborDeskIds: slot.neighborDeskIds.map((id) => `seat-${id.split("-")[1]}`),
    }));
    const relabeled = {
      ...input,
      slots: relabeledSlots,
    };
    const second = solveSeating(relabeled);
    expect(second.status).toBe("ok");
    if (second.status !== "ok") return;
    expect(second.meta.fairnessVector).toEqual(first.meta.fairnessVector);
    expect(evaluateSeatingFairness(relabeled, second.assignments)).toEqual(
      second.meta.fairnessVector,
    );
    expect(chartSignature(first.assignments).length).toBeGreaterThan(0);
  });
});
