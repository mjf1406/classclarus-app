import { describe, expect, test } from "vitest";

import type { Id } from "../../_generated/dataModel.js";
import {
  applySeatingRelaxations,
  diagnoseSeatingConflicts,
  relaxationsFromRules,
  solveWithRelaxations,
} from "./diagnose.js";
import { solveSeating } from "./solve.js";
import type {
  SeatingAlgorithmInput,
  SeatingConstraint,
  SeatingDeskSlot,
  SeatingStudent,
} from "./types.js";
import { assignGenderParity } from "./gender.js";

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

function input(
  args: {
    students?: SeatingStudent[];
    slots?: SeatingDeskSlot[];
    locked?: SeatingAlgorithmInput["locked"];
    constraints?: SeatingConstraint[];
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
    history: { byStudent: new Map() },
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

describe("diagnoseSeatingConflicts", () => {
  test("reports satisfiable when rules can be met", () => {
    const diagnosis = diagnoseSeatingConflicts(input());
    expect(diagnosis).toEqual({ status: "satisfiable" });
  });

  test("finds a minimal conflict for contradictory neighbor rules", () => {
    const students = [student(1), student(2)];
    const layoutSlots = slots(3);
    const constraints = (["must", "mustNot"] as const).map((polarity, index) =>
      constraint(index, {
        type: "neighbor",
        polarity,
        studentUserId: students[0]!.studentUserId,
        otherStudentUserId: students[1]!.studentUserId,
      }),
    );
    const base = input({ students, slots: layoutSlots, constraints });
    const diagnosis = diagnoseSeatingConflicts(base);
    expect(diagnosis.status).toBe("minimalConflict");
    if (diagnosis.status !== "minimalConflict") return;
    expect(diagnosis.rules).toHaveLength(2);
    const relaxed = solveWithRelaxations(base, relaxationsFromRules(diagnosis.rules));
    expect(relaxed.status).toBe("ok");
  });

  test("includes gender parity in minimal conflict with parity lock", () => {
    const male = student(1, "m");
    const base = input({
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
    });
    const diagnosis = diagnoseSeatingConflicts(base);
    expect(diagnosis.status).toBe("minimalConflict");
    if (diagnosis.status !== "minimalConflict") return;
    expect(diagnosis.rules.some((rule) => rule.kind === "genderParity")).toBe(true);
    expect(diagnosis.rules.some((rule) => rule.kind === "lockedSeat")).toBe(true);
    const relaxed = solveWithRelaxations(base, relaxationsFromRules(diagnosis.rules));
    expect(relaxed.status).toBe("ok");
  });

  test("reports structural capacity exceeded", () => {
    const students = [student(1), student(2), student(3)];
    const constraints = students.map((item, index) =>
      constraint(index, {
        type: "zone",
        polarity: "must",
        studentUserId: item.studentUserId,
        zoneName: "Front",
      }),
    );
    const base = input({ students, slots: slots(1), constraints });
    const diagnosis = diagnoseSeatingConflicts(base);
    expect(diagnosis.status === "structural" || diagnosis.status === "minimalConflict").toBe(true);
  });

  test("returns unknown for search exhaustion", () => {
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
    const diagnosis = diagnoseSeatingConflicts(
      input({ students, slots: layoutSlots, constraints }),
    );
    expect(diagnosis.status).toBe("unknown");
    if (diagnosis.status !== "unknown") return;
    expect(diagnosis.code).toBe("SEATING_SEARCH_EXHAUSTED");
    expect(diagnosis.runContext.counts.solverStudentCount).toBe(8);
    expect(diagnosis.evidence?.kind).toBe("searchExhausted");
  });

  test("reports structural unavailable students with evidence", () => {
    const students = [student(1), student(2)];
    const constraints = [
      constraint(0, {
        type: "neighbor",
        polarity: "must",
        studentUserId: students[0]!.studentUserId,
        otherStudentUserId: "missing-student" as Id<"users">,
      }),
    ];
    const base = input({ students, slots: slots(3), constraints });
    const diagnosis = diagnoseSeatingConflicts(base);
    expect(diagnosis.status).toBe("structural");
    if (diagnosis.status !== "structural") return;
    expect(diagnosis.cause).toBe("unavailableStudent");
    expect(diagnosis.evidence.kind).toBe("unavailableStudents");
    expect(diagnosis.affectedStudentIds).toEqual(["missing-student"]);
  });

  test("applySeatingRelaxations omits selected rules", () => {
    const students = [student(1), student(2)];
    const constraints = (["must", "mustNot"] as const).map((polarity, index) =>
      constraint(index, {
        type: "neighbor",
        polarity,
        studentUserId: students[0]!.studentUserId,
        otherStudentUserId: students[1]!.studentUserId,
      }),
    );
    const base = input({ students, slots: slots(2), constraints });
    expect(solveSeating(base).status).toBe("infeasible");
    const relaxed = applySeatingRelaxations(base, {
      omittedConstraintIds: [constraints[0]!.id, constraints[1]!.id],
    });
    expect(relaxed.constraints).toHaveLength(0);
    expect(solveSeating(relaxed).status).toBe("ok");
  });
});

describe("assignGenderParity", () => {
  test("parity assignment is deterministic", () => {
    const a = assignGenderParity({ randomSeed: "seed", mode: "oddEven" });
    const b = assignGenderParity({ randomSeed: "seed", mode: "oddEven" });
    expect(a).toEqual(b);
  });
});
