import { describe, expect, test } from "vitest";

import type { Id } from "../../_generated/dataModel.js";
import { assignGenderParity, genderBucketFromRoster } from "./gender.js";
import { seatHistoryKey } from "./historyKeys.js";
import { expectValidSolverChart } from "./seatingTestHelpers.js";
import { solveSeating } from "./solve.js";
import type {
  LayoutHistoryStats,
  SeatingAlgorithmInput,
  SeatingConstraint,
  SeatingDeskSlot,
  SeatingStudent,
} from "./types.js";

const layoutId = "layout" as Id<"seatLayouts">;
const groupId = "group" as Id<"groups">;

function student(index: number, genderBucket: SeatingStudent["genderBucket"] = "unknown") {
  return {
    studentUserId: `student-${index}` as Id<"users">,
    groupId,
    genderBucket,
  } satisfies SeatingStudent;
}

function slots(count: number): SeatingDeskSlot[] {
  return Array.from({ length: count }, (_, index) => ({
    deskItemId: `desk-${index + 1}`,
    groupId,
    deskNumber: index + 1,
    zoneName: index < Math.ceil(count / 2) ? "Front" : "Back",
    teamKey: index % 2 === 0 ? "name:Blue" : "name:Red",
    neighborDeskIds: [
      ...(index > 0 ? [`desk-${index}`] : []),
      ...(index + 1 < count ? [`desk-${index + 2}`] : []),
    ],
  }));
}

function history(
  entries: Array<{
    student: SeatingStudent;
    seat?: Record<string, number>;
    zone?: Record<string, number>;
    team?: Record<string, number>;
    neighbor?: Record<string, number>;
  }> = [],
): LayoutHistoryStats {
  return {
    byStudent: new Map(
      entries.map((entry) => [
        entry.student.studentUserId,
        {
          seat: new Map(Object.entries(entry.seat ?? {})),
          zone: new Map(Object.entries(entry.zone ?? {})),
          team: new Map(Object.entries(entry.team ?? {})),
          neighbor: new Map(Object.entries(entry.neighbor ?? {}) as Array<[Id<"users">, number]>),
          combination: new Map(),
          total: 0,
        },
      ]),
    ),
  };
}

function input(
  args: {
    students?: SeatingStudent[];
    slots?: SeatingDeskSlot[];
    locked?: SeatingAlgorithmInput["locked"];
    constraints?: SeatingConstraint[];
    history?: LayoutHistoryStats;
    parity?: "off" | "oddEven";
    malesOnOddDesks?: boolean;
    seed?: string;
  } = {},
): SeatingAlgorithmInput {
  return {
    layoutId,
    slots: args.slots ?? slots(3),
    students: args.students ?? [student(1), student(2), student(3)],
    locked: args.locked ?? [],
    constraints: args.constraints ?? [],
    history: args.history ?? history(),
    scope: { kind: "class" },
    genderParityMode: args.parity ?? "off",
    genderParityAssignment: {
      malesOnOddDesks: args.malesOnOddDesks ?? true,
    },
    randomSeed: args.seed ?? "test-seed",
  };
}

function constraint(index: number, values: Omit<SeatingConstraint, "id">): SeatingConstraint {
  return {
    id: `constraint-${index}` as Id<"seatConstraints">,
    ...values,
  };
}

describe("genderBucketFromRoster", () => {
  test("maps binary roster values", () => {
    expect(genderBucketFromRoster("male")).toBe("m");
    expect(genderBucketFromRoster("female")).toBe("f");
    expect(genderBucketFromRoster(undefined)).toBe("unknown");
  });
});

describe("assignGenderParity", () => {
  test("is deterministic for a seed", () => {
    const a = assignGenderParity({ randomSeed: "seed-1", mode: "oddEven" });
    const b = assignGenderParity({ randomSeed: "seed-1", mode: "oddEven" });
    expect(a).toEqual(b);
  });

  test("can flip parity for different seeds", () => {
    const results = new Set<boolean>();
    for (let i = 0; i < 20; i += 1) {
      results.add(assignGenderParity({ randomSeed: `seed-${i}`, mode: "oddEven" }).malesOnOddDesks);
    }
    expect(results.size).toBeGreaterThan(1);
  });
});

function solveExpectingOk(seatingInput: SeatingAlgorithmInput) {
  const result = solveSeating(seatingInput);
  expect(result.status).toBe("ok");
  if (result.status !== "ok") {
    throw new Error(`expected ok, got ${result.status}`);
  }
  expectValidSolverChart(seatingInput, result.assignments);
  return result;
}

describe("solveSeating", () => {
  test("fills every available seat without duplicates", () => {
    const result = solveExpectingOk(input());
    expect(result.assignments).toHaveLength(3);
    expect(new Set(result.assignments.map((row) => row.studentUserId)).size).toBe(3);
    expect(new Set(result.assignments.map((row) => row.deskItemId)).size).toBe(3);
    expect(result.meta.violationCount).toBe(0);
  });

  test("is deterministic for the same seed and input order independent", () => {
    const students = [student(1), student(2), student(3)];
    const first = solveSeating(input({ students, seed: "repeatable" }));
    const second = solveSeating(
      input({
        students: [...students].reverse(),
        slots: [...slots(3)].reverse(),
        seed: "repeatable",
      }),
    );
    expect(first).toEqual(second);
  });

  test("preserves a manual seat and fills only remaining students", () => {
    const students = [student(1), student(2), student(3)];
    const seatingInput = input({
      students,
      locked: [
        {
          studentUserId: students[0]!.studentUserId,
          groupId,
          deskItemId: "desk-2",
        },
      ],
    });
    const result = solveExpectingOk(seatingInput);
    expect(result.assignments).toHaveLength(2);
    expect(result.assignments.some((row) => row.studentUserId === students[0]!.studentUserId)).toBe(
      false,
    );
    expect(result.assignments.some((row) => row.deskItemId === "desk-2")).toBe(false);
  });

  test("chooses unseen seats from recorded history", () => {
    const onlyStudent = student(1);
    const seatingInput = input({
      students: [onlyStudent],
      slots: slots(2),
      history: history([
        {
          student: onlyStudent,
          seat: { [seatHistoryKey(layoutId, "desk-1")]: 5 },
        },
      ]),
    });
    const result = solveExpectingOk(seatingInput);
    expect(result.assignments[0]?.deskItemId).toBe("desk-2");
  });

  test("keeps neighbor fairness ahead of seat fairness", () => {
    const students = [student(1), student(2)];
    const layoutSlots = slots(3);
    layoutSlots[2] = { ...layoutSlots[2]!, neighborDeskIds: [] };
    layoutSlots[1] = {
      ...layoutSlots[1]!,
      neighborDeskIds: ["desk-1"],
    };
    const seatingInput = input({
      students,
      slots: layoutSlots,
      history: history(
        students.map((item) => ({
          student: item,
          seat: {
            [seatHistoryKey(layoutId, "desk-1")]: 10,
            [seatHistoryKey(layoutId, "desk-2")]: 10,
          },
        })),
      ),
    });
    const result = solveExpectingOk(seatingInput);
    expect(new Set(result.assignments.map((row) => row.deskItemId))).toEqual(
      new Set(["desk-1", "desk-2"]),
    );
  });

  test("enforces must-neighbor and must-not-neighbor constraints", () => {
    const students = [student(1), student(2), student(3)];
    const result = solveSeating(
      input({
        students,
        constraints: [
          constraint(1, {
            type: "neighbor",
            polarity: "must",
            studentUserId: students[0]!.studentUserId,
            otherStudentUserId: students[1]!.studentUserId,
          }),
          constraint(2, {
            type: "neighbor",
            polarity: "mustNot",
            studentUserId: students[0]!.studentUserId,
            otherStudentUserId: students[2]!.studentUserId,
          }),
        ],
      }),
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const deskByStudent = new Map(
      result.assignments.map((row) => [row.studentUserId, Number(row.deskItemId.split("-")[1])]),
    );
    expect(
      Math.abs(
        deskByStudent.get(students[0]!.studentUserId)! -
          deskByStudent.get(students[1]!.studentUserId)!,
      ),
    ).toBe(1);
    expect(
      Math.abs(
        deskByStudent.get(students[0]!.studentUserId)! -
          deskByStudent.get(students[2]!.studentUserId)!,
      ),
    ).not.toBe(1);
  });

  test("enforces zone and teammate constraints", () => {
    const students = [student(1), student(2)];
    const layoutSlots = slots(4);
    const result = solveSeating(
      input({
        students,
        slots: layoutSlots,
        constraints: [
          constraint(1, {
            type: "zone",
            polarity: "must",
            studentUserId: students[0]!.studentUserId,
            zoneName: "Back",
          }),
          constraint(2, {
            type: "teammate",
            polarity: "must",
            studentUserId: students[0]!.studentUserId,
            otherStudentUserId: students[1]!.studentUserId,
          }),
        ],
      }),
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const slotByDesk = new Map(layoutSlots.map((slot) => [slot.deskItemId, slot]));
    const assignedSlots = result.assignments.map((row) => slotByDesk.get(row.deskItemId)!);
    expect(
      assignedSlots.find(
        (_, index) => result.assignments[index]?.studentUserId === students[0]!.studentUserId,
      )?.zoneName,
    ).toBe("Back");
    expect(assignedSlots[0]!.teamKey).toBe(assignedSlots[1]!.teamKey);
  });

  test("enforces odd-even gender parity and exempts unknown gender", () => {
    const students = [student(1, "m"), student(2, "f"), student(3, "unknown")];
    const result = solveSeating(
      input({
        students,
        parity: "oddEven",
        malesOnOddDesks: true,
      }),
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const deskByStudent = new Map(
      result.assignments.map((row) => [row.studentUserId, Number(row.deskItemId.split("-")[1])]),
    );
    expect(deskByStudent.get(students[0]!.studentUserId)! % 2).toBe(1);
    expect(deskByStudent.get(students[1]!.studentUserId)! % 2).toBe(0);
  });

  test("rejects a manual placement that violates hard parity", () => {
    const male = student(1, "m");
    const result = solveSeating(
      input({
        students: [male],
        parity: "oddEven",
        malesOnOddDesks: true,
        locked: [
          {
            studentUserId: male.studentUserId,
            groupId,
            deskItemId: "desk-2",
          },
        ],
      }),
    );
    expect(result.status).toBe("infeasible");
  });

  test("returns infeasible for contradictory hard constraints", () => {
    const students = [student(1), student(2)];
    const constraints = (["must", "mustNot"] as const).map((polarity, index) =>
      constraint(index, {
        type: "neighbor",
        polarity,
        studentUserId: students[0]!.studentUserId,
        otherStudentUserId: students[1]!.studentUserId,
      }),
    );
    const result = solveSeating(input({ students, slots: slots(2), constraints }));
    expect(result.status).toBe("infeasible");
    if (result.status === "infeasible") {
      expect(result.code).toBe("SEATING_INFEASIBLE");
    }
  });

  test("reports search exhaustion instead of falsely proving large infeasibility", () => {
    const students = Array.from({ length: 8 }, (_, index) => student(index));
    const layoutSlots = slots(8).map((slot, index) => ({
      ...slot,
      zoneName: index < 6 ? "Limited" : "Other",
    }));
    const constraints = students.slice(0, 7).map((item, index) =>
      constraint(index, {
        type: "zone",
        polarity: "must",
        studentUserId: item.studentUserId,
        zoneName: "Limited",
      }),
    );
    const result = solveSeating(input({ students, slots: layoutSlots, constraints }));
    expect(result.status).toBe("search_exhausted");
  });

  test("keeps students in their own group slots", () => {
    const otherGroupId = "other-group" as Id<"groups">;
    const students = [student(1), { ...student(2), groupId: otherGroupId }];
    const layoutSlots = [slots(1)[0]!, { ...slots(1)[0]!, groupId: otherGroupId }];
    const result = solveSeating(input({ students, slots: layoutSlots }));
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(
      result.assignments.every(
        (assignment) =>
          students.find((item) => item.studentUserId === assignment.studentUserId)?.groupId ===
          assignment.groupId,
      ),
    ).toBe(true);
  });

  test("uses recorded seat totals to choose who sits when capacity is short", () => {
    const students = [student(1), student(2)];
    const result = solveSeating(
      input({
        students,
        slots: slots(1),
        history: history([
          {
            student: students[0]!,
            seat: { [seatHistoryKey(layoutId, "desk-1")]: 4 },
          },
        ]),
      }),
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.assignments[0]?.studentUserId).toBe(students[1]!.studentUserId);
    expect(result.meta.unseatedStudentIds).toEqual([students[0]!.studentUserId]);
  });

  test("returns infeasible when males exceed odd desks under parity", () => {
    const students = [student(1, "m"), student(2, "m"), student(3, "m")];
    const result = solveSeating(
      input({
        students,
        slots: slots(3),
        parity: "oddEven",
        malesOnOddDesks: true,
      }),
    );
    expect(result.status).toBe("infeasible");
    if (result.status === "infeasible") {
      expect(result.evidence.kind).toBe("parityCapacityExceeded");
    }
  });

  test("maps every roster gender into a solver bucket", () => {
    expect(genderBucketFromRoster("male")).toBe("m");
    expect(genderBucketFromRoster("transMale")).toBe("m");
    expect(genderBucketFromRoster("female")).toBe("f");
    expect(genderBucketFromRoster("transFemale")).toBe("f");
    expect(genderBucketFromRoster("nonBinary")).toBe("other");
    expect(genderBucketFromRoster("selfDescribe")).toBe("other");
    expect(genderBucketFromRoster("preferNotToSay")).toBe("other");
    expect(genderBucketFromRoster(undefined)).toBe("unknown");
  });

  test("enforces mustNot zone and teammate constraints by student identity", () => {
    const students = [student(1), student(2)];
    const layoutSlots = slots(4);
    const result = solveSeating(
      input({
        students,
        slots: layoutSlots,
        constraints: [
          constraint(1, {
            type: "zone",
            polarity: "mustNot",
            studentUserId: students[0]!.studentUserId,
            zoneName: "Front",
          }),
          constraint(2, {
            type: "teammate",
            polarity: "mustNot",
            studentUserId: students[0]!.studentUserId,
            otherStudentUserId: students[1]!.studentUserId,
          }),
        ],
      }),
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const slotByDesk = new Map(layoutSlots.map((slot) => [slot.deskItemId, slot]));
    const deskByStudent = new Map(
      result.assignments.map((row) => [row.studentUserId, row.deskItemId]),
    );
    expect(slotByDesk.get(deskByStudent.get(students[0]!.studentUserId)!)?.zoneName).toBe("Back");
    const teamA = slotByDesk.get(deskByStudent.get(students[0]!.studentUserId)!)?.teamKey;
    const teamB = slotByDesk.get(deskByStudent.get(students[1]!.studentUserId)!)?.teamKey;
    expect(teamA).not.toBe(teamB);
  });

  test("places neighbors on independently adjacent desks", () => {
    const students = [student(1), student(2), student(3)];
    const layoutSlots = slots(3);
    const result = solveSeating(
      input({
        students,
        slots: layoutSlots,
        constraints: [
          constraint(1, {
            type: "neighbor",
            polarity: "must",
            studentUserId: students[0]!.studentUserId,
            otherStudentUserId: students[1]!.studentUserId,
          }),
        ],
      }),
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const deskByStudent = new Map(
      result.assignments.map((row) => [row.studentUserId, row.deskItemId]),
    );
    const slotByDesk = new Map(layoutSlots.map((slot) => [slot.deskItemId, slot]));
    const left = slotByDesk.get(deskByStudent.get(students[0]!.studentUserId)!)!;
    const right = slotByDesk.get(deskByStudent.get(students[1]!.studentUserId)!)!;
    expect(
      left.neighborDeskIds.includes(right.deskItemId) ||
        right.neighborDeskIds.includes(left.deskItemId),
    ).toBe(true);
  });

  test("reverses odd-even parity when malesOnOddDesks is false", () => {
    const students = [student(1, "m"), student(2, "f")];
    const result = solveSeating(
      input({
        students,
        slots: slots(2),
        parity: "oddEven",
        malesOnOddDesks: false,
      }),
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const deskByStudent = new Map(
      result.assignments.map((row) => [row.studentUserId, Number(row.deskItemId.split("-")[1])]),
    );
    expect(deskByStudent.get(students[0]!.studentUserId)! % 2).toBe(0);
    expect(deskByStudent.get(students[1]!.studentUserId)! % 2).toBe(1);
  });

  test("treats other gender as exempt from odd-even parity", () => {
    const students = [student(1, "other"), student(2, "m")];
    const result = solveSeating(
      input({
        students,
        slots: slots(2),
        parity: "oddEven",
        malesOnOddDesks: true,
      }),
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const deskByStudent = new Map(
      result.assignments.map((row) => [row.studentUserId, Number(row.deskItemId.split("-")[1])]),
    );
    expect(deskByStudent.get(students[1]!.studentUserId)! % 2).toBe(1);
  });

  test("is infeasible when a male is locked to an unnumbered desk under parity", () => {
    const male = student(1, "m");
    const layoutSlots = slots(2).map((slot, index) =>
      index === 0 ? { ...slot, deskNumber: undefined } : slot,
    );
    const result = solveSeating(
      input({
        students: [male],
        slots: layoutSlots,
        parity: "oddEven",
        malesOnOddDesks: true,
        locked: [
          {
            studentUserId: male.studentUserId,
            groupId,
            deskItemId: "desk-1",
          },
        ],
      }),
    );
    expect(result.status).toBe("infeasible");
  });

  test("uses exact infeasible rather than search_exhausted at seven students", () => {
    const students = Array.from({ length: 7 }, (_, index) => student(index));
    const layoutSlots = slots(7).map((slot, index) => ({
      ...slot,
      zoneName: index < 3 ? "Limited" : "Other",
    }));
    const constraints = students.map((item, index) =>
      constraint(index, {
        type: "zone",
        polarity: "must",
        studentUserId: item.studentUserId,
        zoneName: "Limited",
      }),
    );
    const result = solveSeating(input({ students, slots: layoutSlots, constraints }));
    expect(result.status).toBe("infeasible");
  });

  test("independent checker holds for remaining success fixtures", () => {
    const students = [student(1), student(2), student(3)];
    const fixtures = [
      input({
        students,
        constraints: [
          constraint(1, {
            type: "neighbor",
            polarity: "must",
            studentUserId: students[0]!.studentUserId,
            otherStudentUserId: students[1]!.studentUserId,
          }),
          constraint(2, {
            type: "neighbor",
            polarity: "mustNot",
            studentUserId: students[0]!.studentUserId,
            otherStudentUserId: students[2]!.studentUserId,
          }),
        ],
      }),
      input({
        students: [student(1, "m"), student(2, "f"), student(3, "unknown")],
        parity: "oddEven",
        malesOnOddDesks: true,
      }),
      input({
        students: [student(1), student(2)],
        slots: slots(4),
        constraints: [
          constraint(1, {
            type: "zone",
            polarity: "mustNot",
            studentUserId: students[0]!.studentUserId,
            zoneName: "Front",
          }),
          constraint(2, {
            type: "teammate",
            polarity: "mustNot",
            studentUserId: students[0]!.studentUserId,
            otherStudentUserId: students[1]!.studentUserId,
          }),
        ],
      }),
      input({
        students: [student(1, "m"), student(2, "f")],
        slots: slots(2),
        parity: "oddEven",
        malesOnOddDesks: false,
      }),
      input({
        students: [student(1, "other"), student(2, "m")],
        slots: slots(2),
        parity: "oddEven",
        malesOnOddDesks: true,
      }),
    ];
    for (const fixture of fixtures) {
      solveExpectingOk(fixture);
    }
  });
});
