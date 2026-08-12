import { describe, expect, it } from "vite-plus/test";

import { recordAssignmentsInHistory, testInput } from "./seatingTestHelpers.js";
import { solveSeating } from "./solve.js";
import type { LayoutHistoryStats } from "./types.js";

const SIMULATION_SEEDS = [
  0x0000_0001, 0x0000_beef, 0x0123_4567, 0x0bad_f00d, 0x1234_abcd, 0x3141_5926, 0x6d2b_79f5,
  0x9e37_79b9, 0xcafe_babe, 0xdead_beef, 0xfeed_face, 0xffff_fffe,
] as const;

function spread(values: readonly number[]): number {
  return values.length === 0 ? 0 : Math.max(...values) - Math.min(...values);
}

function simulate(args: {
  studentCount: number;
  slotCount: number;
  topology: "line" | "ring" | "complete";
  seed: number;
  runs?: number;
}): { input: ReturnType<typeof testInput>; history: LayoutHistoryStats } {
  let history: LayoutHistoryStats = { byStudent: new Map() };
  let latestInput = testInput({
    studentCount: args.studentCount,
    slotCount: args.slotCount,
    topology: args.topology,
  });
  for (let run = 0; run < (args.runs ?? 50); run += 1) {
    latestInput = testInput({
      studentCount: args.studentCount,
      slotCount: args.slotCount,
      topology: args.topology,
      seed: `${args.seed.toString(16)}:${run}`,
      history,
    });
    const result = solveSeating(latestInput);
    expect(
      result.status,
      `seed=0x${args.seed.toString(16)} run=${run} topology=${args.topology}`,
    ).toBe("ok");
    if (result.status !== "ok") break;
    history = recordAssignmentsInHistory(latestInput, result.assignments);
  }
  return { input: latestInput, history };
}

describe("seating long-run fairness simulations", () => {
  it.each(SIMULATION_SEEDS)(
    "cycles every student through seats, zones, and teams (seed=%s)",
    (seed) => {
      const { input, history } = simulate({
        studentCount: 8,
        slotCount: 8,
        topology: "complete",
        seed,
      });
      for (const student of input.students) {
        const stats = history.byStudent.get(student.studentUserId)!;
        const seatCounts = input.slots.map(
          (slot) => stats.seat.get(`${input.layoutId}:${slot.deskItemId}`) ?? 0,
        );
        expect(
          Math.min(...seatCounts),
          `seed=0x${seed.toString(16)} student=${student.studentUserId} dimension=seat`,
        ).toBeGreaterThan(0);
        expect(spread(seatCounts)).toBeLessThanOrEqual(2);
        expect(spread(["A", "B"].map((key) => stats.zone.get(key) ?? 0))).toBeLessThanOrEqual(2);
        expect(
          spread(["name:One", "name:Two"].map((key) => stats.team.get(key) ?? 0)),
        ).toBeLessThanOrEqual(2);
      }
    },
  );

  it.each(SIMULATION_SEEDS)(
    "avoids starving attainable neighbors on a sparse layout (seed=%s)",
    (seed) => {
      const { input, history } = simulate({
        studentCount: 6,
        slotCount: 6,
        topology: "ring",
        seed,
      });
      for (const student of input.students) {
        const stats = history.byStudent.get(student.studentUserId)!;
        const counts = input.students
          .filter((other) => other.studentUserId !== student.studentUserId)
          .map((other) => stats.neighbor.get(other.studentUserId) ?? 0);
        expect(
          Math.min(...counts),
          `seed=0x${seed.toString(16)} student=${student.studentUserId} dimension=neighbor`,
        ).toBeGreaterThan(0);
        expect(spread(counts)).toBeLessThanOrEqual(2);
      }
    },
  );

  it.each(SIMULATION_SEEDS)("rotates scarce seats without starving a student (seed=%s)", (seed) => {
    const { input, history } = simulate({
      studentCount: 7,
      slotCount: 4,
      topology: "line",
      seed,
    });
    const totals = input.students.map((student) => {
      const stats = history.byStudent.get(student.studentUserId);
      return stats ? [...stats.seat.values()].reduce((sum, count) => sum + count, 0) : 0;
    });
    expect(Math.min(...totals)).toBeGreaterThan(0);
    expect(spread(totals)).toBeLessThanOrEqual(1);
  });

  it.each(SIMULATION_SEEDS)(
    "rotates students fairly around an immutable manual seat (seed=%s)",
    (seed) => {
      let history: LayoutHistoryStats = { byStudent: new Map() };
      let latestInput = testInput({
        studentCount: 5,
        slotCount: 5,
        topology: "ring",
      });
      const locked = {
        studentUserId: latestInput.students[0]!.studentUserId,
        groupId: latestInput.students[0]!.groupId,
        deskItemId: latestInput.slots[0]!.deskItemId,
      };
      for (let run = 0; run < 50; run += 1) {
        latestInput = {
          ...testInput({
            studentCount: 5,
            slotCount: 5,
            topology: "ring",
            seed: `locked:${seed.toString(16)}:${run}`,
            history,
          }),
          locked: [locked],
        };
        const result = solveSeating(latestInput);
        expect(result.status, `seed=0x${seed.toString(16)} run=${run}`).toBe("ok");
        if (result.status !== "ok") break;
        expect(result.assignments.some((row) => row.studentUserId === locked.studentUserId)).toBe(
          false,
        );
        history = recordAssignmentsInHistory(latestInput, [locked, ...result.assignments]);
      }
      const lockedStats = history.byStudent.get(locked.studentUserId)!;
      const neighborCounts = latestInput.students
        .slice(1)
        .map((student) => lockedStats.neighbor.get(student.studentUserId) ?? 0);
      expect(Math.min(...neighborCounts)).toBeGreaterThan(0);
      expect(spread(neighborCounts)).toBeLessThanOrEqual(2);
    },
  );
});
