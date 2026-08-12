import { describe, expect, it } from "vite-plus/test";

import {
  assignEquitable,
  assignEquitableSlots,
  buildExperienceCounts,
  buildEquitableAssignSlots,
} from "../../../convex/lib/assigners/equitableAssign";

const pickFirst = () => 0;

function recipient(
  id: string,
  genderBucket: "m" | "f" | "other" | "unknown",
  groupId?: string,
  rosterNumber?: number,
) {
  return {
    studentUserId: id,
    genderBucket,
    ...(groupId ? { groupId, groupName: groupId } : {}),
    rosterNumber,
  };
}

describe("assignEquitable", () => {
  it("prioritizes students with fewer total assignments", () => {
    const prior = [
      { studentUserId: "u1", item: "A" },
      { studentUserId: "u1", item: "B" },
      { studentUserId: "u2", item: "A" },
    ];

    const result = assignEquitable({
      items: ["A", "B"],
      recipients: [recipient("u1", "m"), recipient("u2", "m"), recipient("u3", "m")],
      scope: "class",
      balanceGender: false,
      priorAssignments: prior,
      random: pickFirst,
    });

    expect(result.map((row) => row.studentUserId)).toEqual(["u3", "u2"]);
  });

  it("assigns the item a student has done least often", () => {
    const prior = [
      { studentUserId: "u1", item: "A" },
      { studentUserId: "u1", item: "A" },
      { studentUserId: "u1", item: "B" },
    ];

    const result = assignEquitable({
      items: ["A", "B"],
      recipients: [recipient("u1", "m")],
      scope: "class",
      balanceGender: false,
      priorAssignments: prior,
      random: pickFirst,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.item).toBe("B");
  });

  it("preserves locked manual assignments and fills remaining slots", () => {
    const slots = buildEquitableAssignSlots({
      items: ["A", "B", "C"],
      scope: "class",
      balanceGender: false,
      groups: [],
      recipients: [recipient("u1", "m"), recipient("u2", "f"), recipient("u3", "m")],
    });

    const lockedSlot = slots[0]!;
    const result = assignEquitableSlots({
      items: ["A", "B", "C"],
      slots,
      recipients: [recipient("u1", "m"), recipient("u2", "f"), recipient("u3", "m")],
      scope: "class",
      balanceGender: false,
      priorAssignments: [],
      lockedAssignments: [{ slotId: lockedSlot.id, studentUserId: "u1" }],
      random: pickFirst,
    });

    expect(result).toHaveLength(3);
    expect(result.find((row) => row.slotId === lockedSlot.id)?.studentUserId).toBe("u1");
    expect(new Set(result.map((row) => row.studentUserId))).toEqual(new Set(["u1", "u2", "u3"]));
  });

  it("scopes groups independently while using global history", () => {
    const prior = [
      { studentUserId: "a1", item: "A", groupId: "g1", groupName: "G1" },
      { studentUserId: "a1", item: "A", groupId: "g1", groupName: "G1" },
      { studentUserId: "b1", item: "A", groupId: "g2", groupName: "G2" },
    ];

    const result = assignEquitable({
      items: ["A"],
      recipients: [
        recipient("a1", "m", "g1"),
        recipient("a2", "f", "g1"),
        recipient("b1", "m", "g2"),
        recipient("b2", "f", "g2"),
      ],
      scope: "groups",
      balanceGender: false,
      priorAssignments: prior,
      random: pickFirst,
    });

    expect(result).toHaveLength(2);
    expect(result.find((row) => row.groupId === "g1")?.studentUserId).toBe("a2");
    expect(result.find((row) => row.groupId === "g2")?.studentUserId).toBe("b2");
  });

  it("creates gender-balanced slots only for buckets present in each pool", () => {
    const slots = buildEquitableAssignSlots({
      items: ["A"],
      scope: "class",
      balanceGender: true,
      genderBuckets: ["m", "f", "other"],
      groups: [],
      recipients: [recipient("boy", "m"), recipient("other", "other")],
    });

    expect(slots.map((slot) => slot.genderRequired)).toEqual(["m", "other"]);
  });

  it("eventually gives every student each item over repeated runs", () => {
    const items = ["A", "B"];
    const recipients = [
      recipient("u1", "m", undefined, 1),
      recipient("u2", "f", undefined, 2),
      recipient("u3", "m", undefined, 3),
    ];
    let prior: Array<{ studentUserId: string; item: string }> = [];

    for (let run = 0; run < 6; run += 1) {
      const batch = assignEquitable({
        items,
        recipients,
        scope: "class",
        balanceGender: false,
        priorAssignments: prior,
        random: pickFirst,
        runCount: run,
      });
      prior = [...prior, ...batch];
    }

    const experience = buildExperienceCounts(prior);
    for (const student of recipients) {
      for (const item of items) {
        expect(experience.itemByStudent.get(student.studentUserId)?.get(item) ?? 0).toBeGreaterThan(
          0,
        );
      }
    }
  });

  it("does not assign duplicate students in one run", () => {
    const result = assignEquitable({
      items: ["A", "B", "C", "D"],
      recipients: [recipient("u1", "m"), recipient("u2", "f"), recipient("u3", "m")],
      scope: "class",
      balanceGender: false,
      priorAssignments: [],
      random: pickFirst,
    });

    const ids = result.map((row) => row.studentUserId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(3);
  });
});
