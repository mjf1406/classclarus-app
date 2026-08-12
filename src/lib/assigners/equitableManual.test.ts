import { describe, expect, it } from "vite-plus/test";

import {
  assignmentsComplete,
  buildEquitableManualSlots,
  validateEquitableManualAssignments,
} from "../../../convex/lib/assigners/equitableManualSlots";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  hasRandomAssignableRemaining,
  randomAssignRemaining,
  studentEligibleForSlot,
  type EquitableManualStudent,
} from "./equitableManual";

const groupA = { groupId: "groupA" as Id<"groups">, groupName: "Group A" };
const groupB = { groupId: "groupB" as Id<"groups">, groupName: "Group B" };

function student(
  userId: string,
  genderBucket: EquitableManualStudent["genderBucket"],
  groupId?: Id<"groups">,
): EquitableManualStudent {
  return {
    userId: userId as Id<"users">,
    displayName: userId,
    genderBucket,
    ...(groupId ? { groupId } : {}),
  };
}

/** Returns 0 for every call — picks first eligible option in shuffles. */
const pickFirst = () => 0;

describe("buildEquitableManualSlots", () => {
  it("creates one slot per item for class scope", () => {
    const slots = buildEquitableManualSlots({
      items: ["A", "B"],
      scope: "class",
      balanceGender: false,
      groups: [],
    });
    expect(slots).toHaveLength(2);
    expect(slots.map((slot) => slot.item)).toEqual(["A", "B"]);
  });

  it("doubles slots when balancing gender with eligible students", () => {
    const slots = buildEquitableManualSlots({
      items: ["A"],
      scope: "class",
      balanceGender: true,
      groups: [],
      recipients: [{ genderBucket: "m" }, { genderBucket: "f" }],
    });
    expect(slots).toHaveLength(2);
    expect(slots.map((slot) => slot.genderRequired)).toEqual(["m", "f"]);
  });

  it("creates per-group slots in groups scope", () => {
    const slots = buildEquitableManualSlots({
      items: ["A"],
      scope: "groups",
      balanceGender: false,
      groups: [groupA, groupB],
    });
    expect(slots).toHaveLength(2);
    expect(slots.map((slot) => slot.groupId)).toEqual([groupA.groupId, groupB.groupId]);
  });
});

describe("validateEquitableManualAssignments", () => {
  const slots = buildEquitableManualSlots({
    items: ["A", "B"],
    scope: "class",
    balanceGender: false,
    groups: [],
  });

  const recipients = [
    { studentUserId: "u1" as Id<"users">, genderBucket: "m" as const },
    { studentUserId: "u2" as Id<"users">, genderBucket: "f" as const },
  ];

  it("accepts a complete valid assignment", () => {
    const result = validateEquitableManualAssignments({
      slots,
      assignments: [
        { slotId: slots[0]!.id, studentUserId: "u1" as Id<"users"> },
        { slotId: slots[1]!.id, studentUserId: "u2" as Id<"users"> },
      ],
      recipients,
      scope: "class",
      balanceGender: false,
    });
    expect(result).toEqual({ ok: true });
    expect(
      assignmentsComplete(slots, [
        { slotId: slots[0]!.id, studentUserId: "u1" as Id<"users"> },
        { slotId: slots[1]!.id, studentUserId: "u2" as Id<"users"> },
      ]),
    ).toBe(true);
  });

  it("rejects duplicate students", () => {
    const result = validateEquitableManualAssignments({
      slots,
      assignments: [
        { slotId: slots[0]!.id, studentUserId: "u1" as Id<"users"> },
        { slotId: slots[1]!.id, studentUserId: "u1" as Id<"users"> },
      ],
      recipients,
      scope: "class",
      balanceGender: false,
    });
    expect(result).toEqual({ ok: false, code: "DUPLICATE_STUDENT" });
  });

  it("rejects gender mismatch", () => {
    const genderSlots = buildEquitableManualSlots({
      items: ["A"],
      scope: "class",
      balanceGender: true,
      groups: [],
      recipients: [{ genderBucket: "m" }, { genderBucket: "f" }],
    });
    const boySlot = genderSlots.find((slot) => slot.genderRequired === "m");
    expect(boySlot).toBeDefined();
    const result = validateEquitableManualAssignments({
      slots: genderSlots,
      assignments: [
        { slotId: boySlot!.id, studentUserId: "u2" as Id<"users"> },
        {
          slotId: genderSlots.find((slot) => slot.genderRequired === "f")!.id,
          studentUserId: "u1" as Id<"users">,
        },
      ],
      recipients,
      scope: "class",
      balanceGender: true,
    });
    expect(result).toEqual({ ok: false, code: "GENDER_MISMATCH" });
  });
});

describe("randomAssignRemaining", () => {
  it("preserves existing assignments and fills empty slots", () => {
    const slots = buildEquitableManualSlots({
      items: ["A", "B", "C"],
      scope: "class",
      balanceGender: false,
      groups: [],
    });
    const students = [student("u1", "m"), student("u2", "f"), student("u3", "m")];
    const existing = [{ slotId: slots[0]!.id, studentUserId: "u1" as Id<"users"> }];

    const result = randomAssignRemaining({
      slots,
      students,
      assignments: existing,
      scope: "class",
      random: pickFirst,
    });

    expect(result).toHaveLength(3);
    expect(result.find((row) => row.slotId === slots[0]!.id)?.studentUserId).toBe("u1");
    const newAssignments = result.filter((row) => row.slotId !== slots[0]!.id);
    expect(newAssignments).toHaveLength(2);
    expect(new Set(newAssignments.map((row) => row.studentUserId))).toEqual(new Set(["u2", "u3"]));
  });

  it("respects gender-balanced slots", () => {
    const students = [student("boy", "m"), student("girl", "f")];
    const slots = buildEquitableManualSlots({
      items: ["A"],
      scope: "class",
      balanceGender: true,
      groups: [],
      recipients: students.map((row) => ({ genderBucket: row.genderBucket })),
    });
    const boySlot = slots.find((slot) => slot.genderRequired === "m")!;
    const girlSlot = slots.find((slot) => slot.genderRequired === "f")!;

    const result = randomAssignRemaining({
      slots,
      students,
      assignments: [],
      scope: "class",
      random: pickFirst,
    });

    expect(result).toHaveLength(2);
    expect(result.find((row) => row.slotId === boySlot.id)?.studentUserId).toBe("boy");
    expect(result.find((row) => row.slotId === girlSlot.id)?.studentUserId).toBe("girl");
  });

  it("respects group scope", () => {
    const slots = buildEquitableManualSlots({
      items: ["A"],
      scope: "groups",
      balanceGender: false,
      groups: [groupA, groupB],
    });
    const slotA = slots.find((slot) => slot.groupId === groupA.groupId)!;
    const slotB = slots.find((slot) => slot.groupId === groupB.groupId)!;
    const students = [student("a1", "m", groupA.groupId), student("b1", "f", groupB.groupId)];

    const result = randomAssignRemaining({
      slots,
      students,
      assignments: [],
      scope: "groups",
      random: pickFirst,
    });

    expect(result).toHaveLength(2);
    expect(result.find((row) => row.slotId === slotA.id)?.studentUserId).toBe("a1");
    expect(result.find((row) => row.slotId === slotB.id)?.studentUserId).toBe("b1");
  });

  it("leaves extra students unassigned when slots run out", () => {
    const slots = buildEquitableManualSlots({
      items: ["A"],
      scope: "class",
      balanceGender: false,
      groups: [],
    });
    const students = [student("u1", "m"), student("u2", "f"), student("u3", "m")];

    const result = randomAssignRemaining({
      slots,
      students,
      assignments: [],
      scope: "class",
      random: pickFirst,
    });

    expect(result).toHaveLength(1);
  });

  it("leaves slots empty when no eligible students remain", () => {
    const students = [student("boy", "m")];
    const slots = buildEquitableManualSlots({
      items: ["A", "B"],
      scope: "class",
      balanceGender: true,
      groups: [],
      recipients: students.map((row) => ({ genderBucket: row.genderBucket })),
    });
    const boySlots = slots.filter((slot) => slot.genderRequired === "m");

    const result = randomAssignRemaining({
      slots,
      students,
      assignments: [],
      scope: "class",
      random: pickFirst,
    });

    expect(result).toHaveLength(1);
    expect(boySlots.some((slot) => slot.id === result[0]!.slotId)).toBe(true);
    expect(slots.filter((slot) => slot.genderRequired === "f")).toHaveLength(0);
  });

  it("reports when random assignment is possible", () => {
    const slots = buildEquitableManualSlots({
      items: ["A"],
      scope: "class",
      balanceGender: false,
      groups: [],
    });
    const students = [student("u1", "m")];

    expect(
      hasRandomAssignableRemaining({
        slots,
        students,
        assignments: [],
        scope: "class",
      }),
    ).toBe(true);

    expect(
      hasRandomAssignableRemaining({
        slots,
        students,
        assignments: [{ slotId: slots[0]!.id, studentUserId: "u1" as Id<"users"> }],
        scope: "class",
      }),
    ).toBe(false);
  });

  it("only assigns eligible students to gender slots", () => {
    const slots = buildEquitableManualSlots({
      items: ["A"],
      scope: "class",
      balanceGender: true,
      groups: [],
      recipients: [{ genderBucket: "m" }, { genderBucket: "f" }],
    });
    const boySlot = slots.find((slot) => slot.genderRequired === "m")!;
    expect(studentEligibleForSlot(student("boy", "m"), boySlot, "class")).toBe(true);
    expect(studentEligibleForSlot(student("girl", "f"), boySlot, "class")).toBe(false);
  });
});
